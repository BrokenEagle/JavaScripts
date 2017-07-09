// ==UserScript==
// @name         Validate Blacklist
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      16
// @source       https://danbooru.donmai.us/users/23799
// @description  Validate blacklist tags
// @author       BrokenEagle
// @match        *://*.donmai.us
// @match        *://*.donmai.us/posts*
// @exclude      *://*.donmai.us/posts/*
// @grant        none
// @run-at       document-body
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/validateblacklist.js
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
const max_running_lists = 4;
const debug_console = false;

const legend = `
<span><b><u>Legend:</u></b></span>
<ul>
<li><b>Bad</b>: Single tag with <s>strikethrough</s>.</li>
<li><b>Alias</b>: Antecedent with arrow -&gt to consequent.</li>
<li><b>Redundant</b>: Single tag with <s>strikethrough</s> plus arrow ==&gt to <u>underlined</u> tag(s) that make it redundant.</li>
<li><b>Fixed combo</b>: Old combotag with <s>strikethrough</s> plus arrow =&gt to <i>italic</i> new combotag.</li>
</ul>
`;

////////////////
//Classes

//Main application class
class ValidateBlacklist {
    constructor(list,logger) {
        this.id = _.uniqueId();
        this.async_requests = 0;
        list = _.map(list,$.trim);
        this.original_list = _.uniq(list);
        this.duplicates = list.length - this.original_list.length;
        this.combo_tags = _.filter(this.original_list, tag=>{return tag.search(" ") >= 0;});
        this.combo_lists = _.map(this.combo_tags,str=>{return new ValidateBlacklist(str.split(' '));});
        $.each(this.combo_lists, (i,list)=>{list.is_sublist = true;});
        this.exclude_tags = _(this.original_list).difference(this.combo_tags).filter(tag=>{return tag
                            .match(/^-?(?:rating:[esq]|score:<-?\d+|status:(?:flagged|pending|deleted|banned)|pool:.+|user:.+)/);
                            }).value();
        //This is the list of tags that will be processed
        this.working_list = _(this.original_list).difference(this.exclude_tags).difference(this.combo_tags).value();
        //Keep track of all negatives
        this.negative_list = _(this.working_list).filter(val=>{return val[0]=='-';}).map(tag=>{return tag.match(/^-?(.*)$/)[1];}).value();
        //Removes negative so that tag/alias/implication lookups will work properly
        this.working_list = _(this.working_list).map(tag=>{return tag.match(/^-?(.*)$/)[1];}).value();
        //This allows us to retain the original order... remove all negatives except for combo and exclude tags
        this.normal_list = _(this.original_list).map(tag=>{return ($.inArray(tag,this.combo_tags.concat(this.exclude_tags))<0?tag.match(/^-?(.*)$/)[1]:tag);}).value();
        this.fixed_combo_tags = [];
        this.bad_tags = [];
        this.tag_aliases = {};
        this.aliased_tags = {};
        this.tag_implications = {};
        this.superfluous_tags = {};
        this.bad_combo_entry = {};
        this.bad_regular_entry = {};
        this.reconstructed_list = [];
        this.reconstructed_html = "";
        this.is_sublist = false;
        this.is_running = false;
        this.is_ready = false;
        this.stop = false;
        this.window_size = 0;
        this.logger = logger || {'log':function (){}};
        this.error = false;
        this.unchanged = false;
        this.combos_started = false;
        this.last_logged = 0;
        this.stage = 0;
    }
    //////////////////////////
    //Getter/setter functions
    get comboready() {
        return _.reduce(this.combo_lists,(result,value)=>{return result && value.is_ready;},true);
    }
    get comboremain() {
        return _.reduce(this.combo_lists,(result,value)=>{return result + (value.is_ready?0:1);},0);
    }
    get comborunning() {
        return _.reduce(this.combo_lists,(result,value)=>{return result + (value.is_running?1:0);},0);
    }
    //Set the window size between 0 and max_window_size based upon remaing requests
    setWindow(adder) {
        adder = (this.async_requests>=0?adder:adder*-1);
        this.window_size = Math.min(Math.max(this.window_size + adder,0),max_window_size);
    }
    isNegative(tag) {
        return ($.inArray(tag,this.negative_list)>=0);
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
    //////////////////
    //Combo functions
    //Asynchronously process all combo lists
    async processComboLists() {
        //Async functions need their own try/catch blocks
        try {
            for(let i=0;i<this.combo_lists.length;i++) {
                //Limit the number of combos that can be running at once
                while(this.comborunning >= max_running_lists) {
                    let comboremain = this.comboremain;
                    if (comboremain != this.last_logged) {
                        this.alllog(`Combos remaining: ${comboremain}`);
                        this.last_logged = comboremain;
                    }
                    let temp = await sleep(sleep_wait_time);
                }
                if (this.stop) {this.is_running=false;return;}
                this.combo_lists[i].processList();
            }
        }
        catch (e) {
            this.error = true;
            this.alllog(e.stack);
        }
    }
    ///////////////////////
    //Main functions
    //Sequentially process asynchronous requests
    processList() {
        try {
            if (this.stage===0) {
                this.is_running = true;
                console.time("processList"+this.id.toString());
                this.alllog("Getting tag aliases...");
                //Aliases are gotten first since aliases would show up as invalid by the validateTag function
                this.getAliases();
                this.stage = 1;
                return;
            }
            if (this.stage==1) {
                this.alllog("Finding nonexistant tags...");
                //Since there is no alias chaining, the following may not be required, but just in case...
                //Record all aliased tags found taking into account any chained values
                $.each(this.working_list,(i,value)=>{
                    let alias = this.getLastAlias(value);
                    if(value!=alias) {
                        this.aliased_tags[value]=alias;
                    }
                });
                //Replace all tags in the working list with their aliases
                $.each(this.working_list,(i,value)=>{
                    this.working_list[i] = this.getLastAlias(value);
                });
                //Validate tags next to avoid processing any more bogus entries
                this.validateTags();
                this.stage = 2;
                return;
            }
            if (this.stage==2) {
                this.alllog("Getting tag implications...");
                //Remove any bad tags
                this.working_list = _.difference(this.working_list,this.bad_tags);
                //Finally, check for implications
                this.getImplications();
                this.stage = 3;
                return;
            }
            if (this.stage==3) {
                //Find all tags with matching ancestors in the current list
                this.findSuperfluousTags();
                //We are done processing for sublists, but not yet for the main list
                this.is_ready = this.is_sublist;
                this.is_running = false;
                this.stage = 4;
            }
            if (!this.is_sublist) {
                //Separate variable since we only want to run the following codeblock once
                if (!this.combos_started) {
                    this.combos_started = true;
                    this.alllog("Processing combo tags...");
                    //Process all combo lists asynchronously
                    this.processComboLists();
                }
                if (this.comboready) {
                    this.alllog("Finalizing...");
                    this.reconstructList();
                    this.is_ready = true;
                    this.alllog("Done!");
                } else {
                    //Keep checking until comboready is true
                    var me = this;
                    setTimeout(()=>{me.callback();},polling_interval);
                    return;
                }
            } else {
                //Sublist will process reconstruct list and then exit
                this.reconstructList();
            }
            console.timeEnd("processList"+this.id.toString());
        }
        catch (e) {
            this.error = true;
            this.alllog(e.stack);
        }
    }
    //This callback helps serialize all of the stages
    //Callback has window context, so "this" token must be passed to it
    callback() {
        if (this.stop) {this.is_running=false;return;}
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
    async validateTags() {
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
                const resp = $.getJSON('/tags',{'search':{'name':tag,'hide_empty':'yes'}},data=>{
                    //No results means the tag is empty or bad
                    if (data.length===0) {
                        this.bad_tags.push(tag);
                    }
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
    //Alias functions
    //This function provides the iterator and is asynchronous
    async getAliases() {
        try {
            for(let i=0;i<this.working_list.length;i++) {
                if (this.stop) {this.is_running=false;return;}
                if (this.async_requests > (max_async_requests+this.window_size)) {
                    this.logRemaining(i);
                    let temp = await sleep(sleep_wait_time);
                    this.setWindow(1);
                }
                this.recurseAlias(this.working_list[i]);
            }
            var me = this;
            setTimeout(()=>{me.callback();},polling_interval);
        }
        catch (e) {
            this.error = true;
            this.alllog(e.stack);
        }
    }
    //This function provides the recursion and is synchronous
    //May not be strictly needed as aliases are supposedly without chains
    recurseAlias(tag) {
        //This is for if recursive alias retrieval has already gotten the alias
        if (tag in this.tag_aliases) { return;}
        this.async_requests++;
        const resp = $.getJSON('/tag_aliases',{'search':{'antecedent_name':tag}},data=>{
            //Only process active aliases
            if ((data.length > 0) && (data[0].status == 'active')) {
                let consequent = data[0].consequent_name;
                this.tag_aliases[tag] = consequent;
                //Add negative of applicable consequents to assist with tag replacements later on
                if (this.isNegative(tag)) {
                    this.negative_list.push(consequent);
                }
                this.recurseAlias(consequent);
            }
        }).always(()=>{
            this.async_requests--;
        });
    }
    //This function may not be required, since alias chains are supposed to be disallowed
    getLastAlias(tag) {
        let list = this.tag_aliases;
        if (tag in list)  {
            return this.getLastAlias(this.tag_aliases[tag]);
        } else {
            return tag;
        }
    }
    ///////////////////////////////////
    //Implication function
    async getImplications() {
        try {
            for(let i=0;i<this.working_list.length;i++) {
                if (this.stop) {this.is_running=false;return;}
                if (this.async_requests > (max_async_requests+this.window_size)) {
                    this.logRemaining(i);
                    let temp = await sleep(sleep_wait_time);
                    this.setWindow(1);
                }
                this.recurseImplication(this.working_list[i]);
            }
            var me = this;
            setTimeout(()=>{me.callback();},polling_interval);
        }
        catch (e) {
            this.error = true;
            this.alllog(e.stack);
        }
    }
    recurseImplication(tag) {
        if (tag in this.tag_implications) { return;}
        this.async_requests++;
        const resp = $.getJSON('/tag_implications',{'search':{'antecedent_name':tag}},data=>{
            if (data.length>0) {
                //Filter out any inactive implications here
                let consequents = _.map(_.filter(data,['status','active']),'consequent_name');
                this.tag_implications[tag] = consequents;
                $.each(consequents, (i,implication)=>{
                    this.recurseImplication(implication);
                });
            }
        }).always(()=>{
            this.async_requests--;
        });
    }
    //Get all ancestor implications for a tag
    allrelations(tag) {
        var tmp = [];
        let itemdict = this.tag_implications;
        if (tag in this.tag_implications) {
            for(let i=0;i<itemdict[tag].length;i++) {
                tmp.push(itemdict[tag][i]);
                let tmp2 = this.allrelations(itemdict[tag][i]);
                tmp = tmp.concat(tmp2);
            }
            return tmp;
        } else {
            return [];
        }
    }
    //Find any tag that has an ancestor in the working list
    findSuperfluousTags() {
        $.each(this.working_list, (i,tag)=>{
           if (tag in this.tag_implications) {
                let relations = _.uniq(this.allrelations(tag));
                let similarities = _.intersection(relations,this.working_list);
                $.each(similarities,(i,sim)=>{
                    //When negations match, i.e. ++ or --, then ancestor tags make the current tag superfluous
                    if(this.isNegative(tag)==this.isNegative(sim)){
                        //Create a new list or update an existing list
                        this.superfluous_tags[tag] = (tag in this.superfluous_tags?this.superfluous_tags[tag].concat(sim):[sim]);
                    }
                    //Combo entries won't fire if the tag is positive and the ancestor is negative
                    else if (!this.isNegative(tag)&&this.isNegative(sim)) {
                        this.bad_combo_entry[tag] = (tag in this.bad_combo_entry?this.bad_combo_entry[tag].concat(sim):[sim]);
                    }
                    //Regular entries will blacklist everything if the tag is negative and the ancestor is positive
                    else if (this.isNegative(tag)&&!this.isNegative(sim)) {
                        this.bad_regular_entry[tag] = (tag in this.bad_regular_entry?this.bad_regular_entry[tag].concat(sim):[sim]);
                    }
                });
           }
        });
    }
    //Code check the following function
    //Render functions
    reconstructList() {
        //Helps with HTML formatting
        let currindex = 0;
        //Allows us to build the HTML an entry at a time
        let buildhtml = [];
        //These types of tag chains will cause all posts to be hidden
        //These will not be dropped... they require manual decisions
        if ((!this.is_sublist)&&(Object.keys(this.bad_regular_entry).length>0)) {
            buildhtml.push(`<span>Bad tag chaining: (will hide all posts)</span>`);
            //Not a sublist, so keep list entry separate
            let temphtml = [];
            $.each(this.bad_regular_entry, (key,val)=>{
                let htmltag = sanitizeForHTML(key);
                let similarity = sanitizeForHTML(val.join(", "));
                temphtml.push(liWrapper(`<span>${htmltag} ==> ${similarity}</span>`,true));
            });
            buildhtml.push(ulWrapper(temphtml.join('\r\n'),true));
        }
        //These types of tag chains will prevent a combo entry from ever firing
        //These will be dropped
        else if ((this.is_sublist)&&(Object.keys(this.bad_combo_entry).length>0)) {
            //This is a sublist entry, so wrap it all in a list
            buildhtml.push(liWrapper(`<span>Bad tag chaining: (will hide no posts)</span>`,true));
            $.each(this.bad_combo_entry, (key,val)=>{
                let htmltag = sanitizeForHTML(key);
                let similarity = sanitizeForHTML(val.join(", "));
                buildhtml.push(liWrapper(`<span>${htmltag} ==> ${similarity}</span>`,true));
            });
            this.reconstructed_html = ulWrapper(buildhtml.join('\r\n'),true);
            //Throwing out the whole combo tag as invalid
            return;
        }
        //Check and report on duplicate removal
        if (this.duplicates > 0) {
            buildhtml.push(liWrapper(`<span>Duplicates found: ${this.duplicates}</span>`,this.is_sublist));
        }
        //Now process each tag individually
        $.each(this.normal_list, (i,tag)=> {
            let negativeadd = (($.inArray(tag,this.negative_list))>=0?'-':'');
            let displaychar = (this.is_sublist?String.fromCharCode("a".charCodeAt() + currindex):currindex+1);
            //Process combo tags and continue
            if (($.inArray(tag,this.combo_tags)>=0)) {
                let index = this.combo_tags.indexOf(tag);
                let htmltag = sanitizeForHTML(tag);
                let combo_tag = this.combo_lists[index].reconstructed_list.join(' ');
                let dirty = false;
                //Bad combo tag... remove from list
                if (Object.keys(this.combo_lists[index].bad_combo_entry).length>0) {
                    buildhtml.push(`<span>${displaychar}: <s>${htmltag}</s></span>`);
                    dirty = true;
                } else {
                    this.reconstructed_list.push(combo_tag);
                }
                //Valid combo tag but has changed
                if ((!dirty)&&(tag != combo_tag)) {
                    let htmlcombotag = sanitizeForHTML(combo_tag);
                    buildhtml.push(`<span>${displaychar}: <s>${htmltag}</s> => <i>${htmlcombotag}</i></span>`);
                    dirty = true;
                }
                //Change detected... update HTML
                if (dirty) {
                    buildhtml.push(this.combo_lists[index].reconstructed_html);
                    currindex++;
                }
                return; //continue
            }
            //Push and continue
            if (($.inArray(tag,this.exclude_tags)>=0)) {
                this.reconstructed_list.push(negativeadd+tag);
                return; //continue
            }
            //Drop and continue
            if (($.inArray(tag,this.bad_tags)>=0)) {
                let htmltag = sanitizeForHTML(tag);
                buildhtml.push(liWrapper(`<span>${displaychar}: <s>${htmltag}</s></span>`,this.is_sublist));
                currindex++;
                return; //continue
            }
            let savetag = negativeadd+tag;
            //Replace and then check implications
            if (tag in this.aliased_tags) {
                savetag = negativeadd+this.aliased_tags[tag];
                let htmltag = sanitizeForHTML(tag);
                let htmlaliastag = sanitizeForHTML(this.aliased_tags[tag]);
                buildhtml.push(liWrapper(`<span>${displaychar}: ${htmltag} -> ${htmlaliastag}</span>`,this.is_sublist));
                currindex++;
                //Update display char for any superfluous tags found
                displaychar = (this.is_sublist?String.fromCharCode("a".charCodeAt() + currindex):currindex+1);
                tag = this.aliased_tags[tag];
                //Don't continue just yet... check for an implication match
            }
            //Drop and continue
            if (tag in this.superfluous_tags) {
                let htmltag = sanitizeForHTML(tag);
                let similarity = sanitizeForHTML(this.superfluous_tags[tag].join(", "));
                buildhtml.push(liWrapper(`<span>${displaychar}: <s>${htmltag}</s> ==> <u>${similarity}</u></span>`,this.is_sublist));
                currindex++;
                return; //continue
            }
            //Push and continue
            if (savetag) {
                this.reconstructed_list.push(savetag);
            }
            //End of "each" statement
        });
        this.reconstructed_html = ulWrapper(buildhtml.join('\r\n'),this.is_sublist);
        if (this.reconstructed_html==="") {
            this.reconstructed_html= "No faults found!";
            this.unchanged = true;
        } else {
            //this.reconstructed_html = legend + this.reconstructed_html;
        }
    }
    //////////////////////
    //Control functions
    allstop() {
        this.stop = true;
        $.each(this.combo_lists, (i,list)=>{list.stop = true;});
    }
    //Wait to call reset until all lists are no longer running
    reset() {
        $.each(this.combo_lists, (i,list)=>{list.reset();});
        this.async_requests = 0;
        this.working_list = _(this.original_list).difference(this.exclude_tags).difference(this.combo_tags).map(tag=>{return tag.match(/^-?(.*)$/)[1];}).value();
        this.fixed_combo_tags = [];
        this.bad_tags = [];
        this.tag_aliases = {};
        this.aliased_tags = {};
        this.tag_implications = {};
        this.superfluous_tags = {};
        this.reconstructed_list = [];
        this.reconstructed_html = "";
        this.is_running = false;
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
ValidateBlacklist.legend = legend;

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

function liWrapper(text,wrap) {
    return (wrap?`<li>${text}</li>`:text);
}

function ulWrapper(text,wrap) {
    return (wrap?`<ul>\r\n${text}\r\n</ul>`:text);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//Export list
window.ValidateBlacklist = ValidateBlacklist;
window.TextboxLogger = TextboxLogger;

})();
