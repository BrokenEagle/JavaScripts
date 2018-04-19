// ==UserScript==
// @name         CurrentUploads
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      3.2
// @source       https://danbooru.donmai.us/users/23799
// @description  Gives up-to-date stats on uploads
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/currentuploads.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180416/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180416/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180416/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180416/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180416/lib/validate.js
// ==/UserScript==

/**GLOBAL VARIABLES**/

//Variables for debug.js
const debug_console = true;

//Variables for load.js
const program_load_max_retries = 10;
const program_load_variable_list = ['jQuery','Danbooru'];
const program_load_required_variables = ['jQuery','Danbooru'];

//Affects how much of a tag will be shown
const max_column_characters = 20;

//Column headers of the count table
const column_headers = ['Name','Day','Week','Month','Year','All-time'];

//Time constant
const one_minute = 60 * 1000;

//Value expirations
const expirations = {'d':5,'w':60,'mo':24*60,'y':7*24*60,'at':30*24*60};
const rti_expiration = 30*24*60 * one_minute; //one month

//Network call configuration
const max_post_limit_query = 100;
const max_network_requests = 25;
const rate_limit_wait = 500;

//Placeholders for setting during program execution
var username;
var use_dummy_value;
var num_network_requests = 0;

//Style information
const program_css = `
#upload-counts {
    border: lightgrey dotted;
    max-width: ${max_column_characters + 35}em;
}
#count-table {
    margin-bottom: 1em;
    display: none;
    white-space: nowrap;
    max-height: 20em;
    overflow-x: hidden;
    overflow-y: auto;
    border: lightgrey solid 1px;
}
#upload-counts > span,
#upload-counts .striped {
    margin-left: 2em;
}
#empty-uploads {
    margin: 1em;
    font-size: 200%;
    font-weight: bold;
    font-family: monospace;
}
`;

//HTML for user interface
var notice_box = `
<div class="ui-corner-all" id="upload-counts">
    <div id="count-table">
    </div>
    <span><a href="#" id="hide-count-notice">Toggle Upload Table</a></span>
</div>
`;

//Used for value validations
const validation_constraints = {
    countentry: postcount_constraints,
    implicationentry: {
        presence: true,
        numericality: {
            noStrings: true,
            onlyInteger: true
        }
    },
    postentry: {
        presence: true,
        array: true
    }
};

/**FUNCTIONS**/

//Validation functions

function ValidationSelector(key) {
    if (key.match(/^ct-/)) {
        return 'countentry';
    } else if (key.match(/^rti-/)) {
        return 'implicationentry';
    }
    else if (key === 'current-uploads') {
        return 'postentry';
    }
}

function BuildValidator(key) {
    return {
        expires: expires_constraints,
        value: validation_constraints[ValidationSelector(key)]
    };
}

function ValidateEntry(key,entry) {
    if (entry === null) {
        debuglog(key,"entry not found!");
        return false;
    }
    check = validate(entry,BuildValidator(key));
    if (check !== undefined) {
        printValidateError(key,check);
        return false;
    }
    return true;
}

//Table functions

function AddTable(input) {
    return '<table class="striped">\r\n' + input + '</table>\r\n';
}

function AddTableHead(input) {
    return '<thead>\r\n' + input + '</thead>\r\n';
}

function AddTableBody(input) {
    return '<tbody>\r\n' + input + '</tbody>\r\n';
}

function AddTableRow(input) {
    return '<tr>\r\n' + input + '</tr>\r\n';
}

function AddTableHeader(input) {
    return '<th>' + input + '</th>\r\n';
}

function AddTableData(input) {
    return '<td>' + input + '</td>\r\n';
}

//Render functions

function RenderTable() {
    return AddTable(RenderHeader() + RenderBody());
}

function RenderHeader() {
    var tabletext = '';
    $.each(column_headers,(i,column)=>{
        tabletext += AddTableHeader(column);
    });
    return AddTableHead(tabletext);
}

function RenderBody() {
    var tabletext = RenderRow('');
    for (let i = 0;i < ProcessUploads.copytags.length; i++) {
        tabletext += RenderRow(ProcessUploads.copytags[i]);
    }
    return AddTableBody(tabletext);
}

function RenderRow(key) {
    const timevalues = ['d','w','mo','y','at'];
    var rowtag = encodeURIComponent(key == ''? 'user:' + username : key);
    var rowtext = (key == ''? username : key).replace(/_/g,' ');
    var tabletext = AddTableData(PostSearchLink(rowtag,MaxEntryLength(rowtext)));
    for (let i = 0;i < timevalues.length; i++) {
        tabletext += AddTableData(GetTableValue(key,timevalues[i]));
    }
    return AddTableRow(tabletext);
}

function PostSearchLink(tag,text) {
    return `<a href=/posts?tags=${tag}>${text}</a>`;
}

function GetTableValue(key,type) {
    if (key == '') {
        //Adding the '' to undefined changes it to a string
        return (getSessionData('ct' + type + '-user:' + username).value + '').toString();
    }
    var useruploads = (getSessionData('ct' + type + '-user:' + username + ' ' + key).value + '').toString();
    var alluploads = (getSessionData('ct' + type + '-' + key).value + '').toString();
    return `(${useruploads}/${alluploads})`;
}

//Helper functions

//Returns key array of a counted dictionary from highest to lowest
function SortDict(dict) {
    var items = Object.keys(dict).map(function(key) {
        return [key, dict[key]];
    });

    items.sort(function(first, second) {
        return second[1] - first[1];
    });
    return items.map(entry=>{return entry[0];});
}

function RandomDummyTag() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    var result = '';
    for (var i = 8; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return 'dummytag-' + result;
}

function BuildTagParams(type,tag) {
    return {'tags':(type === 'at' ? '' : ('age:..1' + type + ' ')) + tag + (use_dummy_value ? ' -' + RandomDummyTag() : '')};
}

function MaxEntryLength(string) {
    if (string.length > max_column_characters) {
        string = string.slice(0,max_column_characters-1) + '…';
    }
    return string;
}

function RemoveDanbooruDuplicates(array) {
    let seen_array = [];
    return array.filter(value=>{
        if ($.inArray(value.id,seen_array) >= 0) {
            return;
        }
        seen_array.push(value.id);
        return value;
    });
}

function IncrementCounter() {
    num_network_requests += 1;
    $('#loading-counter').html(num_network_requests);
}

function DecrementCounter() {
    num_network_requests -= 1;
    $('#loading-counter').html(num_network_requests);
}

async function RateLimit() {
    while (num_network_requests >= max_network_requests) {
        await sleep(rate_limit_wait);
    }
}

function GetTagData(tag) {
    return Promise.all([
        GetCount('d',tag),
        GetCount('w',tag),
        GetCount('mo',tag),
        GetCount('y',tag),
        GetCount('at',tag)
    ]);
}

//Network functions

async function GetReverseTagImplication(tag) {
    var key = 'rti' + '-' + tag;
    var check = await checkLocalDB(key,ValidateEntry);
    if (!(check)) {
        debuglog("Network (implication):",key);
        await RateLimit();
        IncrementCounter();
        recordTime(key,'Network');
        return $.getJSON('/tag_implications?search[antecedent_name]=' + encodeURIComponent(tag)
        ).then(data=>{
            saveData(key, {'value':data.length,'expires':Date.now() + rti_expiration});
        }).always(()=>{
            recordTimeEnd(key,'Network');
            DecrementCounter();
        });
    }
}

async function GetCount(type,tag) {
    var key = 'ct' + type + '-' + tag;
    var check = await checkLocalDB(key,ValidateEntry);
    if (!(check)) {
        debuglog("Network (count):",key);
        await RateLimit();
        IncrementCounter();
        recordTime(key,'Network');
        return $.getJSON('/counts/posts',BuildTagParams(type,tag)
        ).then(data=>{
            saveData(key, {'value':data.counts.posts,'expires':Date.now() + expirations[type] * one_minute});
        }).always(()=>{
            recordTimeEnd(key,'Network');
            DecrementCounter();
        });
    }
}

async function GetCurrentUploads(username) {
    let key = `current-uploads-${username}`;
    var check = await checkLocalDB(key,ValidateEntry);
    if (!(check)) {
        debuglog("Network (current uploads)");
        let pagenum = 1;
        let data = [];
        while(true) {
            recordTime(key + '-page' + pagenum,'Network');
            let posts =  await $.getJSON('/posts',Object.assign(BuildTagParams('d',`user:${username}`),{limit: max_post_limit_query, page: pagenum}));
            recordTimeEnd(key + '-page' + pagenum,'Network');
            data = data.concat(posts);
            if (posts.length !== max_post_limit_query) {
                break;
            }
            pagenum += 1;
        }
        data = RemoveDanbooruDuplicates(data);
        saveData(key,{'value':data,'expires':Date.now() + 5 * one_minute});
        return data;
    } else {
        return getSessionData(key).value;
    }
}

//Main functions

async function ProcessUploads() {
    var promise_array = [GetTagData(`user:${username}`)];
    var copyright_count = {};
    var current_uploads = await GetCurrentUploads(username);
    if (current_uploads.length) {
        $.each(current_uploads,(i,entry)=>{
            $.each(entry.tag_string_copyright.split(' '),(j,tag)=>{
                copyright_count[tag] = (tag in copyright_count ? copyright_count[tag] + 1: 1);
            });
        });
        debuglog("All copyrights found:", copyright_count);
        await Promise.all($.map(copyright_count,(val,key)=>{return GetReverseTagImplication(key);}));
        ProcessUploads.copytags = SortDict(copyright_count);
        ProcessUploads.copytags = ProcessUploads.copytags.filter(value=>{return getSessionData('rti-'+value).value == 0;});
        promise_array = promise_array.concat($.map(ProcessUploads.copytags,(key)=>{return GetTagData(key);}));
        promise_array = promise_array.concat($.map(ProcessUploads.copytags,(key)=>{return GetTagData(`user:${username} ${key}`);}));
        await Promise.all(promise_array);
    }
    return current_uploads;
}

function SetCountNoticeClick() {
    $("#hide-count-notice").click((e)=>{
        if (!PopulateTable.is_started || Danbooru.Cookie.get('hide-current-uploads') === "1") {
            Danbooru.Cookie.put('hide-current-uploads',0);
            $('#count-table').show();
        } else {
            Danbooru.Cookie.put('hide-current-uploads',1);
            $('#count-table').hide();
        }
        PopulateTable();
        e.preventDefault();
    });
}

async function PopulateTable() {
    if (!PopulateTable.is_started) {
        PopulateTable.is_started = true;
        $('#count-table').html(`<div id="empty-uploads">Loading data... (<span id="loading-counter">${num_network_requests}</span>)</div>`);
        let data = await ProcessUploads();
        if (data.length) {
            $('#count-table').html(RenderTable());
        } else {
            $('#count-table').html('<div id="empty-uploads">Feed me more uploads!</div>');
        }
    }
}
PopulateTable.is_started = false;

function main() {
    username = Danbooru.meta("current-user-name");
    use_dummy_value = $('body').data('user-is-gold');
    if (username === "Anonymous") {
        return;
    }
    setCSSStyle(program_css,'program');
    $('header#top').append(notice_box);
    SetCountNoticeClick();
    if (Danbooru.Cookie.get('hide-current-uploads') !== "1") {
        $("#hide-count-notice").click();
    }
    if (debug_console) {
        window.onbeforeunload = function () {
            outputAdjustedMean();
        };
    }
}

programInitialize(main,'CU');
