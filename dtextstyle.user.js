// ==UserScript==
// @name         DText Styler
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      4
// @source       https://danbooru.donmai.us/users/23799
// @description  Danbooru DText UI addon.
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/DTextStyler.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/DTextStyler.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/PapaParse/4.3.3/papaparse.min.js
// ==/UserScript==

(function() {
'use strict';

////////////////
//Constants

const buttondict = {
    'bold': {
        'inline':true,
        'block':false,
        'prefix':'[b]',
        'suffix':'[/b]',
        'content':'<svg height="16" version="1.1" viewBox="0 0 10 16" width="10"><path fill-rule="evenodd" d="M1 2h3.83c2.48 0 4.3.75 4.3 2.95 0 1.14-.63 2.23-1.67 2.61v.06c1.33.3 2.3 1.23 2.3 2.86 0 2.39-1.97 3.52-4.61 3.52H1V2zm3.66 4.95c1.67 0 2.38-.66 2.38-1.69 0-1.17-.78-1.61-2.34-1.61H3.13v3.3h1.53zm.27 5.39c1.77 0 2.75-.64 2.75-1.98 0-1.27-.95-1.81-2.75-1.81h-1.8v3.8h1.8v-.01z"></path></svg>'
    },
    'italic': {
        'inline':true,
        'block':false,
        'prefix':'[i]',
        'suffix':'[/i]',
        'content':'<svg height="16" version="1.1" viewBox="0 0 6 16" width="6"><path fill-rule="evenodd" d="M2.81 5h1.98L3 14H1l1.81-9zm.36-2.7c0-.7.58-1.3 1.33-1.3.56 0 1.13.38 1.13 1.03 0 .75-.59 1.3-1.33 1.3-.58 0-1.13-.38-1.13-1.03z"></path></svg>'
    },
    'underline': {
        'inline':true,
        'block':false,
        'prefix':'[u]',
        'suffix':'[/u]',
        'content':'<svg height="16" version="1.1" viewBox="4 4 16 16" width="20"><path fill-rule="evenodd" d="M7.5,6.5h2v5.959c-0.104,1.707,0.695,2.002,2,2.041c1.777,0.062,2.002-0.879,2-2.041V6.5h2v6.123 c0,1.279-0.338,2.245-1.016,2.898c-0.672,0.651-1.666,0.979-2.98,0.979c-1.32,0-2.319-0.326-2.996-0.979 C7.836,14.868,7.5,13.902,7.5,12.623V6.5 M6.5,17.5h10v1h-10V17.5z"></path></svg>'
    },
    'strikethrough': {
        'inline':true,
        'block':false,
        'prefix':'[s]',
        'suffix':'[/s]',
        'content':'<svg height="16" version="1.1" viewBox="4 4 16 16" width="20"><path fill-rule="evenodd" d="M4.833,12.5h12v1h-12V12.5z M10.927,6.5c-1.133,0-2.076,0.287-2.75,0.9c-0.67,0.613-1,1.49-1,2.52c0,0.889,0.221,1.602,0.719,2.13 c0.498,0.528,1.279,0.91,2.312,1.14l0.812,0.182v-0.03c0.656,0.147,1.128,0.375,1.375,0.63c0.252,0.256,0.375,0.607,0.375,1.11 c0,0.573-0.172,0.97-0.531,1.26c-0.358,0.291-0.894,0.45-1.625,0.45c-0.477,0-0.969-0.074-1.469-0.24 c-0.502-0.166-1.031-0.417-1.562-0.75l-0.375-0.238v0.448v1.53v0.18l0.156,0.062c0.58,0.237,1.143,0.417,1.688,0.54 c0.549,0.121,1.07,0.18,1.562,0.18c1.286,0,2.297-0.293,3-0.9c0.709-0.605,1.062-1.486,1.062-2.608 c0-0.943-0.256-1.726-0.781-2.312c-0.521-0.592-1.305-1-2.344-1.229l-0.812-0.181c-0.716-0.148-1.204-0.352-1.406-0.539 C9.128,10.532,9.021,10.25,9.021,9.8c0-0.533,0.162-0.899,0.5-1.17c0.342-0.271,0.836-0.42,1.531-0.42 c0.395,0,0.818,0.052,1.25,0.181c0.433,0.127,0.908,0.333,1.406,0.6l0.375,0.18V7.13c0,0-1.188-0.383-1.688-0.479 C11.896,6.553,11.411,6.5,10.927,6.5z"></path></svg>'
    },
    'translation': {
        'inline':true,
        'block':false,
        'prefix':'[tn]',
        'suffix':'[/tn]',
        'content':'<div style="margin-bottom:-4px;margin-left:-2px;white-space:nowrap">Aあ</div>'
    },
    'quote': {
        'inline':false,
        'block':true,
        'prefix':'[quote]',
        'suffix':'[/quote]',
        'content':'<svg height="16" version="1.1" viewBox="0 0 14 16" width="14"><path fill-rule="evenodd" d="M6.16 3.5C3.73 5.06 2.55 6.67 2.55 9.36c.16-.05.3-.05.44-.05 1.27 0 2.5.86 2.5 2.41 0 1.61-1.03 2.61-2.5 2.61-1.9 0-2.99-1.52-2.99-4.25 0-3.8 1.75-6.53 5.02-8.42L6.16 3.5zm7 0c-2.43 1.56-3.61 3.17-3.61 5.86.16-.05.3-.05.44-.05 1.27 0 2.5.86 2.5 2.41 0 1.61-1.03 2.61-2.5 2.61-1.89 0-2.98-1.52-2.98-4.25 0-3.8 1.75-6.53 5.02-8.42l1.14 1.84h-.01z"></path></svg>'
    },
    'expand': {
        'inline':false,
        'block':true,
        'prefix':'[expand]',
        'suffix':'[/expand]',
        'content':'<svg height="16" version="1.1" viewBox="4 4 16 16" width="20"><path fill-rule="evenodd" id="left-bracket" d="M4,12v-1h1c1,0,1,0,1-1V7.614C6,7.1,6.024,6.718,6.073,6.472C6.127,6.22,6.212,6.009,6.33,5.839 C6.534,5.56,6.803,5.364,7.138,5.255C7.473,5.14,8.01,5,8.973,5H10v1H9.248c-0.457,0-0.77,0.191-0.936,0.408 C8.145,6.623,8,6.853,8,7.476v1.857c0,0.729-0.041,1.18-0.244,1.493c-0.2,0.307-0.562,0.529-1.09,0.667 c0.535,0.155,0.9,0.385,1.096,0.688C7.961,12.484,8,12.938,8,13.665v1.862c0,0.619,0.145,0.848,0.312,1.062 c0.166,0.22,0.479,0.407,0.936,0.407L10,17l0,0v1H8.973c-0.963,0-1.5-0.133-1.835-0.248c-0.335-0.109-0.604-0.307-0.808-0.591 c-0.118-0.165-0.203-0.374-0.257-0.625C6.024,16.283,6,15.9,6,15.387V13c0-1,0-1-1-1H4z"/><use transform="matrix(-1,0,0,1,24,0)" id="right-bracket" x="0" y="0" width="24" height="24" xlink:href="#left-bracket"/></svg></svg>'
    },
    'spoiler': {
        'inline':true,
        'block':true,
        'prefix':'[spoiler]',
        'suffix':'[/spoiler]',
        'content':'<svg height="16" version="1.1" viewBox="4 4 16 16" width="20"><path fill-rule="evenodd" d="M11.999 5.022c-3.853 0-6.977 3.124-6.977 6.978 0 3.853 3.124 6.978 6.977 6.978 3.854 0 6.979-3.125 6.979-6.978 0-3.854-3.125-6.978-6.979-6.978zm-5.113 6.978c0-1.092.572-3.25.93-2.929l7.113 7.113c.488.525-1.837.931-2.93.931-2.825-.001-5.113-2.291-5.113-5.115zm9.298 2.929l-7.114-7.113c-.445-.483 1.837-.931 2.929-.931 2.827 0 5.115 2.289 5.115 5.114 0 1.093-.364 3.543-.93 2.93z"></path></svg>'
    },
    'code': {
        'inline':true,
        'block':true,
        'prefix':'[code]',
        'suffix':'[/code]',
        'content':'<svg height="16" version="1.1" viewBox="0 0 14 16" width="14"><path fill-rule="evenodd" d="M9.5 3L8 4.5 11.5 8 8 11.5 9.5 13 14 8 9.5 3zm-5 0L0 8l4.5 5L6 11.5 2.5 8 6 4.5 4.5 3z"></path></svg>'
    },
    'textilelink': {
        'inline':true,
        'block':false,
        'prefix':'&quot;',
        'suffix':'&quot;:[url]',
        'content':'<svg height="16" version="1.1" viewBox="0 0 16 16" width="16"><path fill-rule="evenodd" d="M4 9h1v1H4c-1.5 0-3-1.69-3-3.5S2.55 3 4 3h4c1.45 0 3 1.69 3 3.5 0 1.41-.91 2.72-2 3.25V8.59c.58-.45 1-1.27 1-2.09C10 5.22 8.98 4 8 4H4c-.98 0-2 1.22-2 2.5S3 9 4 9zm9-3h-1v1h1c1 0 2 1.22 2 2.5S13.98 12 13 12H9c-.98 0-2-1.22-2-2.5 0-.83.42-1.64 1-2.09V6.25c-1.09.53-2 1.84-2 3.25C6 11.31 7.55 13 9 13h4c1.45 0 3-1.69 3-3.5S14.5 6 13 6z"></path></svg>'
    },
    'wikilink': {
        'inline':true,
        'block':false,
        'prefix':'[[',
        'suffix':']]',
        'content':'<svg height="16" version="1.1" viewBox="4 4 26 26" width="20"><path fill-rule="evenodd" d="M29 6.428c0 .098-.03.188-.094.27-.062.08-.13.122-.205.122-.612.058-1.115.257-1.505.595-.39.338-.793.983-1.21 1.935L19.63 23.667c-.042.133-.16.2-.35.2a.39.39 0 0 1-.348-.2l-3.568-7.438-4.096 7.435a.39.39 0 0 1-.35.2c-.182 0-.303-.067-.36-.2L4.315 9.35c-.39-.894-.802-1.518-1.234-1.873-.43-.355-1.03-.574-1.804-.658-.066 0-.13-.037-.187-.106a.36.36 0 0 1-.09-.24c0-.226.066-.34.2-.34.556 0 1.14.025 1.746.075.565.05 1.097.072 1.596.072.507 0 1.105-.025 1.796-.075a28.2 28.2 0 0 1 1.92-.076c.132 0 .198.115.198.344 0 .228-.04.342-.124.342-.557.04-.995.183-1.315.425-.32.243-.48.56-.48.953 0 .2.067.45.2.75l5.092 11.68 2.99-5.56-2.732-5.718c-.49-1.028-.894-1.69-1.21-1.986-.315-.297-.793-.478-1.432-.545-.06 0-.116-.035-.17-.104a.377.377 0 0 1-.08-.24c0-.226.057-.34.174-.34.556 0 1.067.024 1.533.074.448.05.926.074 1.433.074.498 0 1.025-.026 1.582-.076a19.55 19.55 0 0 1 1.694-.076c.133 0 .2.115.2.343 0 .23-.042.342-.125.342-1.113.075-1.67.392-1.67.952 0 .25.13.64.386 1.166l1.806 3.665 1.8-3.345c.248-.477.373-.878.373-1.204 0-.768-.557-1.177-1.67-1.227-.1 0-.15-.117-.15-.346 0-.08.025-.16.075-.232.05-.074.1-.11.15-.11.4 0 .89.024 1.47.074.557.05 1.014.075 1.37.075.258 0 .636-.02 1.135-.06.63-.058 1.16-.087 1.582-.087.1 0 .15.097.15.293 0 .26-.092.392-.274.392-.645.065-1.17.244-1.56.536-.396.293-.888.957-1.478 1.99l-2.39 4.43 3.236 6.6 4.79-11.128c.166-.41.25-.786.25-1.128 0-.82-.558-1.253-1.67-1.303-.1 0-.15-.115-.15-.344 0-.227.074-.34.224-.34.406 0 .887.025 1.444.075.515.048.947.073 1.296.073.365 0 .79-.026 1.27-.075.498-.05.946-.076 1.345-.076.117 0 .175.097.175.293z"></path></svg>'
    },
    'searchlink': {
        'inline':true,
        'block':false,
        'prefix':'{{',
        'suffix':'}}',
        'content':'<svg height="16" version="1.1" viewBox="0 0 500 500" width="20"><path fill="none" stroke="#000" stroke-width="36" stroke-linecap="round" d="m280,278a153,153 0 1,0-2,2l170,170m-91-117 110,110-26,26-110-110"></path></svg>'
    }
};

var specialbuttondict = {
    'table': {
        'func':null,
        'content':'<svg height="16" version="1.1" viewBox="0 0 500 500" width="20"><path fill-rule="evenodd" d="M507.948,46.021c-1.367-16.368-14.588-30.13-31.21-30.13H31.782 c-16.622,0-29.844,13.762-31.242,30.13H0v414.825c0,17.544,14.239,31.782,31.782,31.782h444.955 c17.544,0,31.782-14.239,31.782-31.782V46.021H507.948z M158.912,460.846H31.782v-95.347h127.13V460.846z M158.912,336.354 H31.782v-97.985h127.13V336.354z M158.912,206.586H31.782v-95.347h127.13V206.586z M317.825,460.846h-127.13v-95.347h127.13 V460.846z M317.825,336.354h-127.13v-97.985h127.13V336.354z M317.825,206.586h-127.13v-95.347h127.13V206.586z M476.737,460.846 h-127.13v-95.347h127.13V460.846z M476.737,336.354h-127.13v-97.985h127.13V336.354z M476.737,206.586h-127.13v-95.347h127.13 V206.586z"></path></svg>'
    }
};

const dtext_CSS = `
.dtext-markup {
    width: 32px;
    height: 32px;
    margin-right: -5px;
}
`;

//////////////////
//Main functions

function initializeDtextStyler() {
    setCSSStyle(dtext_CSS);
    $(".dtext-previewable textarea").parent().before(renderButtons());
    setButtonClicks();
}

////////////////////
//Helper functions

function setCSSStyle(csstext) {
    let cssstyle = document.createElement('style');
    cssstyle.type = 'text/css';
    cssstyle.innerHTML = csstext;
    document.head.appendChild(cssstyle);
}

function fixSelectionText(prefix,suffix,block,inline) {
    var fixtext = "";
    var activeEl = document.activeElement;
    var activeElTagName = activeEl ? activeEl.tagName.toLowerCase() : null;
    fixtext = activeEl.value.slice(0,activeEl.selectionStart);
    var valueselection = activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd);
    if (block && !inline) {
        fixtext += '\n'+prefix+'\n'+valueselection+'\n'+suffix+'\n';
    } else if (block && inline) {
        if (valueselection.search('\n')>=0) {
            fixtext += '\n'+prefix+'\n'+valueselection+'\n'+suffix+'\n';
        } else {
            fixtext += prefix+valueselection+suffix;
        }
    } else {
        fixtext += prefix+valueselection+suffix;
    }
    fixtext = fixtext.replace(/^\s+/,'');
    var caretPos = fixtext.length;
    fixtext += activeEl.value.slice(activeEl.selectionEnd);
    activeEl.value = fixtext;
    activeEl.setSelectionRange(caretPos, caretPos);
}

function fixTable() {
    var fixtext = "";
    var activeEl = document.activeElement;
    var activeElTagName = activeEl ? activeEl.tagName.toLowerCase() : null;
    fixtext = activeEl.value.slice(0,activeEl.selectionStart);
    var valueselection = activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd);
    fixtext += CSVtoDtextTable(valueselection);
    fixtext = fixtext.replace(/^\s+/,'');
    var caretPos = fixtext.length;
    fixtext += activeEl.value.slice(activeEl.selectionEnd);
    activeEl.value = fixtext;
    activeEl.setSelectionRange(caretPos, caretPos);
}
specialbuttondict.table.func = fixTable;

function CSVtoDtextTable(csvtext) {
    let tabletext = "";
    let sectiontext = "";
    let csvdata = Papa.parse(csvtext);
    $.each(csvdata.data,(i,row)=>{
        let rowtext = "";
        $.each(row,(j,col)=>{
            if (i===0) {
                rowtext += AddTableHeader(col);
            } else {
                rowtext += AddTableData(col);
            }
        });
        sectiontext += AddTableRow(rowtext);
        if (i===0) {
            tabletext += AddTableHead(sectiontext);
            sectiontext = "";
        }
    });
    tabletext += AddTableBody(sectiontext);
    return AddTable(tabletext);
}

function AddTable(input) {
	return '[table]\n' + input + '[/table]\n';
}

function AddTableHead(input) {
	return '[thead]\n' + input + '[/thead]\n';
}

function AddTableBody(input) {
	return '[tbody]\n' + input + '[/tbody]\n';
}

function AddTableRow(input) {
	return '[tr]\n' + input + '[/tr]\n';
}

function AddTableHeader(input) {
	return '[th]' + input + '[/th]\n';
}

function AddTableData(input) {
	return '[td]' + input + '[/td]\n';
}

////////////////////
//Render functions

function renderButton(title,inline,block,prefix,suffix,content) {
    let start_title = title.slice(0,1).toUpperCase() + title.slice(1);
    return `
    <button title=${start_title} type="button" class="dtext-markup" data-block="${block}" data-inline="${inline}" data-prefix="${prefix}" data-suffix="${suffix}">
        ${content}
    </button>`;
}

function renderSpecialButton(title,content) {
    let start_title = title.slice(0,1).toUpperCase() + title.slice(1);
    return `
    <button title=${start_title} name=${title} type="button" class="dtext-markup special-markup">
        ${content}
    </button>`;
}

function renderButtons() {
    let outputtext = `
<div>`;
    $.each(buttondict,(key,val)=>{
        outputtext += renderButton(key,val.inline,val.block,val.prefix,val.suffix,val.content);
    });
    $.each(specialbuttondict,(key,val)=>{
        outputtext += renderSpecialButton(key,val.content);
    });
    return outputtext + `
</div>`;
}

//////////////////
//Click functions
function setButtonClicks() {
    $(".dtext-markup:not(.special-markup)").off().click((e)=>{
        let buttonTA = $(e.currentTarget).parent().parent().find('textarea');
        if (buttonTA.length===0) {return;}
        buttonTA = buttonTA[0];
        let activeTA = document.activeElement;
        if(buttonTA.id!=activeTA.id) {return;}
        let prefix = e.currentTarget.dataset.prefix;
        let suffix = e.currentTarget.dataset.suffix;
        let block = JSON.parse(e.currentTarget.dataset.block);
        let inline = JSON.parse(e.currentTarget.dataset.inline);
        fixSelectionText(prefix,suffix,block,inline);
    });
    $(".special-markup").off().click((e)=>{
        let buttonTA = $(e.currentTarget).parent().parent().find('textarea');
        if (buttonTA.length===0) {return;}
        buttonTA = buttonTA[0];
        let activeTA = document.activeElement;
        if(buttonTA.id!=activeTA.id) {return;}
        let name = e.currentTarget.name;
        specialbuttondict[name].func();
    });
    $.each($(".dtext-markup"),(i,btn)=>{
        btn.onmousedown = (e)=>{
          e = e || window.event;
          e.preventDefault();
        };
    });
}

initializeDtextStyler();

})();
