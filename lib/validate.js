/****DEPENDENCIES****/

/**External dependencies**/
// validate.js (optional)

/**Internal dependencies**/
// JSPLib.utility (optional)

/****SETUP****/

//Linter configuration
/* global JSPLib validate */

JSPLib.validate = {};

//Boilerplate functions

JSPLib.utility = JSPLib.utility || {};
JSPLib.utility.arrayDifference = JSPLib.utility.arrayDifference || (() => []);

/****GLOBAL VARIABLES****/

JSPLib.validate.dom_output = null;

JSPLib.validate.tag_categories = [0, 1, 3, 4, 5];

//Validation constants

JSPLib.validate.hash_constraints = {
    presence: true,
    hash: true
};

JSPLib.validate.boolean_constraints = {
    presence: true,
    boolean: true
};

JSPLib.validate.number_constraints = {
    presence: true,
    numericality: true
};

JSPLib.validate.integer_constraints = {
    presence: true,
    numericality: {
        noStrings: true,
        onlyInteger: true
    }
};

JSPLib.validate.counting_constraints = JSPLib.validate.timestamp_constraints = {
    presence: true,
    numericality: {
        noStrings: true,
        onlyInteger: true,
        greaterThan: -1,
    }
};

JSPLib.validate.id_constraints = JSPLib.validate.postcount_constraints = {
    presence: true,
    numericality: {
        noStrings: true,
        onlyInteger: true,
        greaterThan: 0,
    }
};

JSPLib.validate.expires_constraints = {
    presence: true,
    numericality: {
        onlyInteger: true,
        greaterThan: -1,
    }
};

JSPLib.validate.stringonly_constraints = {
    string: true
};

JSPLib.validate.stringnull_constraints = {
    string: {
        allowNull: true
    }
};

JSPLib.validate.hashentry_constraints = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.hash_constraints
};

JSPLib.validate.basic_number_validator = {
    func: ((value) => typeof value === "number"),
    type: "number"
};

JSPLib.validate.basic_integer_validator = {
    func: Number.isInteger,
    type: "integer"
};

JSPLib.validate.basic_ID_validator = {
    func: ((value) => Number.isInteger(value) && (value > 0)),
    type: "ID"
};

JSPLib.validate.basic_stringonly_validator = {
    func: ((value) => typeof value === "string"),
    type: "string"
};

/****FUNCTIONS****/

//Helper functions

JSPLib.validate.string_constraints = function (string = true, length) {
    let string_constraint = (string ? {string} : {});
    let length_constraint = (length ? {length} : {});
    return Object.assign(string_constraint, length_constraint);
};

JSPLib.validate.array_constraints = function (length) {
    return {
        presence: true,
        array: (length ? {length} : true)
    };
};

JSPLib.validate.arrayentry_constraints = function (length) {
    return {
        expires: this.expires_constraints,
        value: this.array_constraints(length)
    };
};

JSPLib.validate.tagentryarray_constraints = function(categories) {
    let option = (Array.isArray(categories) ? {categories} : true);
    return {
        presence: true,
        tagentryarray: option
    };
};

JSPLib.validate.inclusion_constraints = function (array) {
    return { presence: true, inclusion: array };
};

JSPLib.validate.printValidateError = function (self, key, checkerror) {
    self.debug('logLevel', key, ':\r\n', JSON.stringify(checkerror, null, 2), JSPLib.debug.INFO);
};

JSPLib.validate.renderValidateError = function (key, checkerror) {
    this._executeIfOutput(($domobj) => {
        let output_text = `<b>${key}:</b>\r\n<pre>${JSON.stringify(checkerror, null, 2)}</pre>`;
        $domobj.innerHTML = output_text;
        $domobj.style.setProperty('display', 'block');
    });
};

JSPLib.validate.outputValidateError = function (key, checkerror) {
    this.printValidateError(key, checkerror);
    this.renderValidateError(key, checkerror);
};

JSPLib.validate.hideValidateError = function () {
    this._executeIfOutput(($domobj) => {
        $domobj.style.setProperty('display', 'none');
    });
};

JSPLib.validate.checkOptions = function (options, key) {
    return validate.isHash(options) && key in options;
};

//For validating the base object
JSPLib.validate.validateIsArray = function (key, entry, length) {
    let array_key = this._sanitizeKey(key);
    let check = validate({[array_key]: entry}, {[array_key]: this.array_constraints(length)});
    if (check !== undefined) {
        this.outputValidateError(key, check);
        return false;
    }
    return true;
};

JSPLib.validate.validateIsHash = function (key, entry) {
    let hash_key = this._sanitizeKey(key);
    let check = validate({[hash_key]: entry}, {[hash_key]: this.hash_constraints});
    if (check !== undefined) {
        this.outputValidateError(key, check);
        return false;
    }
    return true;
};

//For basic objects in an array only, i.e. string, integer, etc.
JSPLib.validate.validateArrayValues = function(self, key, array, validator) {
    for (let i = 0;i < array.length; i++) {
        if (!validator.func(array[i])) {
            let display_key = `${key}[${i}]`;
            let display_item = JSON.stringify(array[i]);
            self.debug('logLevel', `"${display_key}" ${display_item} is not a valid ${validator.type}.`, JSPLib.debug.INFO);
            return false;
        }
    }
    return true;
};

JSPLib.validate.correctArrayValues = function(key, array, validator) {
    let error_messages = [];
    //Going in reverse order since the array may be altered
    for (let i = array.length - 1; i >= 0; i--) {
        if (!validator.func(array[i])) {
            let display_key = `${key}[${i}]`;
            let display_item = JSON.stringify(array[i]);
            error_messages.push({[display_key]: `${display_item} is not a valid ${validator.type}.`});
            array.splice(i, 1);
        }
    }
    return error_messages;
};

JSPLib.validate.validateHashEntries = function (key, hash, validator) {
    let check = validate(hash, validator);
    if (check !== undefined) {
        this.outputValidateError(key, check);
        return false;
    }
    let extra_keys = JSPLib.utility.arrayDifference(Object.keys(hash), Object.keys(validator));
    if (extra_keys.length) {
        this.outputValidateError(key, ["Hash contains extra keys.", extra_keys]);
        return false;
    }
    return true;
};

//For basic objects in a hash only, i.e. string, integer, etc.
JSPLib.validate.validateHashValues = function(self, parent_key, hash, validator) {
    for (let key in hash) {
        if (!validator.func(hash[key])) {
            let display_key = `${parent_key}.${key}`;
            let display_item = JSON.stringify(hash[key]);
            self.debug('logLevel', `"${display_key}" ${display_item} is not a valid ${validator.type}.`, JSPLib.debug.INFO);
            return false;
        }
    }
    return true;
};

//Custom validators

if ((typeof validate === 'function') && (typeof validate.validators === 'object')) {
    validate.validators.hash = function(value, options) {
        if (options !== false) {
            if (validate.isHash(value)) {
                return;
            }
            return "is not a hash";
        }
    };

    validate.validators.array = function(value, options, key) {
        if (options !== false) {
            if (!validate.isArray(value)) {
                return "is not an array";
            }
            if (JSPLib.validate.checkOptions(options, 'length')) {
                const usage_messages = {
                    wrongLength: "array is wrong length (should be %{count} items)",
                    tooShort: "array is too short (minimum is %{count} items)",
                    tooLong: "array is too long (maximum is %{count} items)"
                };
                let validator = Object.assign({}, options.length, usage_messages);
                let array_key = JSPLib.validate._sanitizeKey(key);
                let checkerror = validate({[array_key]: value}, {[array_key]: {length: validator}});
                if (checkerror !== undefined) {
                    return checkerror[array_key][0].slice(array_key.length + 1);
                }
            }
        }
    };

    validate.validators.tagentryarray = function(value, options) {
        if (options !== false) {
            if (!validate.isArray(value)) {
                return "is not an array";
            }
            let categories = (JSPLib.validate.checkOptions(options, 'categories') ? options.categories : JSPLib.validate.tag_categories);
            for (let i = 0;i < value.length;i++) {
                if (value[i].length !== 2) {
                    return "must have 2 entries in tag entry [" + i.toString() + "]";
                }
                if (!validate.isString(value[i][0])) {
                    return "must be a string [" + i.toString() + "][0]";
                }
                if (categories.indexOf(value[i][1]) < 0) {
                    return "must be a valid tag category [" + i.toString() + "][1]";
                }
            }
        }
    };

    validate.validators["boolean"] = function(value, options) {
        if (options !== false) {
            if (validate.isBoolean(value)) {
                return;
            }
            return "is not a boolean";
        }
    };

    validate.validators.string = function(value, options) {
        if (options !== false) {
            var message = "";
            //Can't use presence validator so must catch it here
            if (value === undefined) {
                return "can't be missing";
            }
            if (validate.isString(value)) {
                return;
            }
            message += "is not a string";
            if (JSPLib.validate.checkOptions(options, 'allowNull')) {
                if (options.allowNull !== true || value === null) {
                    return;
                }
                message += " or null";
            }
            return message;
        }
    };
}

//Standalone base-type validators

JSPLib.validate.isHash = function (value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

JSPLib.validate.isBoolean = function (value) {
    return typeof value === "boolean";
};

JSPLib.validate.isString = function (value) {
    return typeof value === "string";
};

JSPLib.validate.isNumber = function (value) {
    return typeof value === 'number' && !isNaN(value);
};

JSPLib.validate.validateID = function (value) {
    return Number.isInteger(value) && (value > 0);
};

JSPLib.validate.validateIDList = function (array) {
    return Array.isArray(array) && ((array.length === 0) || ((array.length > 0) && array.reduce((total, val) => this.validateID(val) && total, true)));
};

/****PRIVATE DATA****/

//Functions

JSPLib.validate._executeIfOutput = function (func) {
    if (this.dom_output) {
        let $domobj = document.querySelector(this.dom_output);
        if ($domobj) {
            func($domobj);
        }
    }
};

//validate.js has unwanted behavior for keys with dots or backslashes in them
JSPLib.validate._sanitizeKey = function (key) {
    return key.replace(/\./g, ':').replace(/\\/g, '|');
};

/****INITIALIZATION****/

JSPLib.validate._configuration = {
    nonenumerable: [],
    nonwritable: ['_configuration']
};
JSPLib.initializeModule('validate');
JSPLib.debug.addModuleLogs('validate', ['printValidateError', 'validateArrayValues', 'validateHashValues']);
