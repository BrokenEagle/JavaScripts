/****DEPENDENCIES****/

/**Internal dependencies**/
// JSPLib.Utility

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function ({Utility}) {

const Template = JSPLib.Template;

/****PRIVATE VARIABLES****/

const AT_BLOCK_RULES = /^@(?:counter-style|container|font-face|font-feature-values|keyframes|layer|media|page|position-try|property|scope|starting-style|supports|view-transition)[ {]/;
const AT_STATEMENT_RULES = /^@(?:charset|import|layer|namespace) /;

/****FUNCTIONS****/

Template.trim = function (literals, ...args) {
    return _renderTemplate(literals, args).trim();
};

Template.verboseRegex = function (flags) {
    return function (literals, ...args) {
        let output = _renderTemplate(literals, args);
        return RegExp(output.replace(/\s+/g, ""), flags);
    };
};

Template.normalizeHTML = function ({template = false} = {}) {
    return function (literals, ...args) {
        if (template) {
            return _generateTemplate(_normalizeHTML, literals, args);
        }
        return _normalizeHTML(_renderTemplate(literals, args));
    };
};

Template.normalizeCSS = function ({multiline = true, theme = null} = {}) {
    return function (literals, ...args) {
        let css_text = _renderTemplate(literals, args);
        if ('CSSNestedDeclarations' in JSPLib._window) {
            if (theme !== null) {
                css_text = _renderNestedColorTheme(css_text, theme);
            }
            return css_text;
        }
        let rules = _parseCSSRules(css_text);
        let unnested_css = _renderUnnestedCSS(rules, {multiline});
        if (theme !== null) {
            unnested_css = _renderUnnestedColorTheme(unnested_css, theme);
        }
        return unnested_css;
    };
};

/****PRIVATE FUNCTIONS****/

//Main-functions

function _renderTemplate(literals, args, mapping) {
    let output = "";
    for (let i = 0; i < literals.raw.length; i++) {
        output += literals.raw[i];
        if (i < args.length) {
            var insert;
            if (Utility.isHash(mapping)) {
                if (args[i] in mapping) {
                    insert = mapping[args[i]];
                } else if (Utility.isHash(args[i])) {
                    insert = Object.values(args[i]).at(0);
                } else {
                    insert = "";
                }
            } else {
                insert = args[i];
            }
            output += insert;
        }
    }
    return output;
}

function _generateTemplate(func, literals, args) {
    return function (mapping = {}) {
        return func(_renderTemplate(literals, args, mapping));
    };
}

function _normalizeHTML(output) {
    // Mark all of the spaces surrounded by a gt/lt and a non-space or lt/gt. These spaces need to stay.
    let marked_output = output.replaceAll('> <', '>\xff<').replace(/(?<=>) (?=[^ <])/g, '\xff').replace(/(?<=[^ >]) (?=<)/g, '\xff');
    let normalized_output = marked_output.replace(/\s+/g, ' ').replace(/(?<=>)\s/g, "").replace(/\s(?=<)/g, "").replaceAll(' >', '>');
    // Once the HTML has been normalized, restore all of the intentional spaces.
    return normalized_output.replaceAll('\xff', ' ');
}

function _renderNestedColorTheme(css_text, theme) {
    let lines = css_text.trim().split('\n');
    let theme_lines = lines.map((line) => '    ' + line);
    let auto_lines = lines.map((line) => '        ' + line);
    let theme_css = `body[data-current-user-theme=${theme}] {\n${theme_lines.join('\n')}\n}`;
    let auto_css = `@media (prefers-color-scheme: ${theme}) {\n    body[data-current-user-theme=auto] {\n${auto_lines.join('\n')}\n    }\n}`;
    return '\n' + theme_css + '\n' + auto_css;
}

function _renderUnnestedColorTheme(css_text, theme) {
    let lines = css_text.trim().split('\n');
    let theme_lines = [];
    let auto_lines = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (/^[ /}]/.test(line)) {
            theme_lines.push(line);
            auto_lines.push('    ' + line);
        } else {
            theme_lines.push(`body[data-current-user-theme=${theme}] ${line}`);
            auto_lines.push(`    body[data-current-user-theme=auto] ${line}`);
        }
    }
    let theme_css = theme_lines.join('\n');
    let auto_css = `@media (prefers-color-scheme: ${theme}) {\n${auto_lines.join('\n')}\n}`;
    return '\n' + theme_css + '\n' + auto_css;
}

function _renderUnnestedCSS(rules, {parent = ":root", indent = 0, multiline = true} = {}) {
    let css = "";
    let spacing = Array(indent).fill('    ').join("");
    let joiner = (multiline ? ',\n' : ', ');
    for (let i = 0; i < rules.length; i++) {
        let rule = rules[i];
        if (rule.statement !== null) {
            css += rule.statement + ';\n';
        } else if (rule.comment !== null) {
            css += _renderComment(rule.comment, spacing) + '\n';
        } else if (rule.is_at_block_rule) {
            let block_css = "";
            for (let j = 0; j < rule.subrules.length; j++) {
                block_css += _renderUnnestedCSS(rule.subrules[j], {indent: indent + 1, multiline});
            }
            css += spacing + rule.selectors.join(joiner + spacing) + ' {\n' + block_css + spacing + '}\n';
        } else {
            //let selector = rule.selectors.map((selector) => selector.replace(/&/g, parent)).join(joiner + spacing);
            let selector = rule.selectors.map((selector) => parent.split(/\s*,\s*/).map((par) => selector.replace(/&/g, par))).flat().join(joiner + spacing);
            if (rule.declarations.length) {
                let block_text = rule.declarations.map((decl) => {
                    if (Array.isArray(decl)) {
                        return _renderComment(decl, spacing + '    ');
                    }
                    return spacing + '    ' + decl.text + ';' + (decl.comment ? ' ' + decl.comment : "");
                }).join('\n');
                css += `${spacing}${selector} {\n${block_text}\n${spacing}}\n`;
            }
            for (let j = 0; j < rule.subrules.length; j++) {
                let subrule = rule.subrules[j];
                if (typeof subrule[0] === 'string') {
                    css += _renderComment(subrule, spacing) + '\n';
                } else {
                    css += _renderUnnestedCSS(subrule, {parent: selector, indent, multiline});
                }
            }
        }
    }
    return css;
}

function _parseCSSRules(css, is_subrule = false) {
    let rules = [];
    let state = {
        rule: null,
        start: null,
        index: 0,
        inside_rule: false,
        nested_comment: false,
    };
    // Replace all single-line comments with multi-line comments (the former is not allowed in stylesheets)
    css = css.replace(/\/\/\s*(.*)/g, "/* $1 */");
    for (; state.index < css.length; state.index++) {
        state.rule ??= {comment: null, statement: null, selectors: [], declarations: [], subrules: [], is_at_block_rule: false};
        state.start ??= state.index;
        switch (css[state.index]) {
            case '{':
                _parseRuleStart(state, css, rules, is_subrule);
                break;
            case '}':
                _parseRuleEnd(state, css, rules);
                break;
            case ';':
                _parseDeclaration(state, css, rules);
                break;
            case '/':
                _parseComment(state, css, rules);
                // falls through
            default:
                // do nothing
        }
    }
    return rules;
}

//Sub-functions

function _renderComment(comment_array, spacing) {
    return comment_array.map((comm) => {
        let extra_space = (comm.startsWith('*') ? ' ' : "");
        return spacing + extra_space + comm;
    }).join('\n');
}

function _parseRuleStart(state, css, rules, is_subrule) {
    var block_indices, end, subcss_block, subrule, comment;
    if (!state.inside_rule) {
        state.rule.selectors = _parseSelectors(css.slice(state.start, state.index), is_subrule);
        if (state.rule.selectors[0].match(AT_BLOCK_RULES)) {
            state.rule.is_at_block_rule = true;
            block_indices = _getBlockIndices(css.slice(state.start));
            subcss_block = css.slice(state.start + block_indices.block_start, state.start + block_indices.block_end);
            subrule = _parseCSSRules(subcss_block, false);
            state.rule.subrules.push(subrule);
            rules.push(state.rule);
            state.rule = null;
            state.index = state.start + block_indices.block_end;
        } else {
            state.inside_rule = true;
        }
    } else {
        block_indices = _getBlockIndices(css.slice(state.start));
        end = state.start + block_indices.block_end + 1;
        subcss_block = css.slice(state.start, end);
        subrule = _parseCSSRules(subcss_block, true);
        if (state.nested_comment) {
            comment = state.rule.declarations.pop();
            state.rule.subrules.push(comment);
            state.nested_comment = false;
        }
        state.rule.subrules.push(subrule);
        state.index = end - 1;
    }
    state.start = null;
}

function _parseDeclaration(state, css, rules) {
    let statement = _normalizeString(css.slice(state.start, state.index));
    // Get end-of-line comment
    let comment_match = css.slice(state.index + 1).match(/^( *\/\*.*?\*\/)/);
    let comment = (comment_match ? comment_match[1] : null);
    if (statement.match(AT_STATEMENT_RULES)) {
        rules.push({statement, comment});
    } else {
        _addDeclaration(state.rule.declarations, statement, comment);
    }
    if (comment_match) {
        state.index += comment_match[0].length;
    }
    state.start = null;
    state.nested_comment = false;
}

function _parseRuleEnd(state, css, rules) {
    // For declarations not suffixed with a semi-colon (only/last declaration)
    _addDeclaration(state.rule.declarations, _normalizeString(css.slice(state.start, state.index)));
    rules.push(state.rule);
    state.rule = state.start = null;
    state.nested_comment = state.inside_rule = false;
}

function _parseComment(state, css, rules) {
    if (css[state.index + 1] === '*') {
        let match = css.slice(state.index).match(/\/\*.*?\*\//s);
        if (match) {
            let comment = match[0].split(/\s*\n\s*/);
            if (state.inside_rule) {
                state.nested_comment = true;
                state.rule.declarations.push(comment);
            } else {
                rules.push({comment, statement: null});
            }
            state.index += match[0].length - 1;
            state.start = null;
        }
    }
}

function _parseSelectors(text, is_subrule) {
    let selectors = [];
    let inside_parentheses = false;
    /**
     * Replace selector operators outside of parentheses with a space on both sides.
     * Replace selector operators wihin parentheses with a space only on the right side.
     * Ensure commas within parentheses always have a space to the right.
     * Individual selectors are broken up by commas.
     */
    let formatted_text = text.replace(/\s+/g, ' ').trim().replace(/(?<!\()\s*([>~+])\s*/g, ' $1 ').replace(/(?<=\()\s*([>~+])\s*/g, '$1 ').replace(/\s*,\s*/g, ', ');
    if (formatted_text.match(AT_BLOCK_RULES)) return [formatted_text];
    for (let i = 0; i < formatted_text.length; i++) {
        var start;
        start ??= i;
        switch (formatted_text[i]) {
            case '(':
                inside_parentheses = true;
                break;
            case ')':
                inside_parentheses = false;
                break;
            case ',':
                if (!inside_parentheses) {
                    selectors.push(formatted_text.slice(start, i).trim());
                    start = null;
                }
                // falls through
            default:
                // do nothing;
        }
        // Last iteration
        if (i === formatted_text.length - 1) {
            selectors.push(formatted_text.slice(start, i + 1).trim());
        }
    }
    if (is_subrule) {
        selectors = selectors.map((selector) => (selector.indexOf('&') === -1 ? '& ' + selector : selector));
    }
    return selectors;
}

function _addDeclaration(declarations, declaration, comment = null) {
    if (declaration.indexOf(':') !== -1) {
        // Ensure colons have a space to the right, and !important has a space to the left
        let text = declaration.split(/\s*:\s*/).join(': ').replace(/\s?!important$/, ' !important');
        declarations.push({text, comment});
    }
}

function _getBlockIndices(text) {
    // Searches for text surrounded by curly braces, and returns the string indices of the text within.
    let block_level = -1;
    let block_start = null;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '}') {
            if (block_level === 0) {
                return {block_start, block_end: i};
            } 
            block_level -= 1;
        }
        else if (text[i] === '{') {
            block_level += 1;
            block_start ??= i + 1;
        }
    }
    throw "No blocks found!";
}

function _normalizeString(str) {
    return str.replace(/\s+/g, ' ').trim();
}

/****INITIALIZATION****/

JSPLib.initializeModule('Template');

})(JSPLib);
