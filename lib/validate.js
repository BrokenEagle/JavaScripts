/****DEPENDENCIES****/

/**External dependencies**/
// validate.js (optional)

/**Internal dependencies**/
// JSPLib.utility

/****SETUP****/

//Linter configuration
/* global JSPLib validate */

(function (ValidateJS, debug, utility) {

const validate = JSPLib.validate;

/****GLOBAL VARIABLES****/

validate.dom_output = null;

/****PRIVATE VARIABLES****/

const TAG_CATEGORIES = [0, 1, 3, 4, 5];

//Validation constants

validate.hash_constraints = {
    presence: true,
    hash: true
};

validate.boolean_constraints = {
    presence: true,
    boolean: true
};

validate.number_constraints = {
    presence: true,
    numericality: true
};

validate.integer_constraints = {
    integer: true,
};

validate.counting_constraints = validate.timestamp_constraints = validate.expires_constraints = {
    integer: {
        greaterThanOrEqual: 0,
    },
};

validate.id_constraints = validate.postcount_constraints = {
    integer: {
        greaterThan: 0,
    },
};

validate.stringonly_constraints = {
    string: true
};

validate.stringnull_constraints = {
    string: {
        allowNull: true
    }
};

validate.hashentry_constraints = {
    expires: validate.expires_constraints,
    value: validate.hash_constraints
};

validate.basic_number_validator = {
    func: ((value) => typeof value === "number"),
    type: "number"
};

validate.basic_integer_validator = {
    func: Number.isInteger,
    type: "integer"
};

validate.basic_ID_validator = {
    func: ((value) => Number.isInteger(value) && (value > 0)),
    type: "ID"
};

validate.basic_stringonly_validator = {
    func: ((value) => typeof value === "string"),
    type: "string"
};

/****FUNCTIONS****/

//Helper functions

validate.string_constraints = function (string = true, length) {
    let string_constraint = (string ? {string} : {});
    let length_constraint = (length ? {length} : {});
    return Object.assign(string_constraint, length_constraint);
};

validate.array_constraints = function (length) {
    return {
        presence: true,
        array: (length ? {length} : true)
    };
};

validate.arrayentry_constraints = function (length) {
    return {
        expires: validate.expires_constraints,
        value: validate.array_constraints(length)
    };
};

validate.tagentryarray_constraints = function(categories) {
    let option = (Array.isArray(categories) ? {categories} : true);
    return {
        presence: true,
        tagentryarray: option
    };
};

validate.inclusion_constraints = function (array) {
    return { presence: true, inclusion: array };
};

validate.printValidateError = function (key, checkerror) {
    const printer = debug.getFunctionPrint('validate.printValidateError');
    printer.debuglogLevel(key, ':\r\n', JSON.stringify(checkerror, null, 2), debug.INFO);
};

validate.renderValidateError = function (key, checkerror) {
    _executeIfOutput(($domobj) => {
        let output_text = `<b>${key}:</b>\r\n<pre>${JSON.stringify(checkerror, null, 2)}</pre>`;
        $domobj.innerHTML = output_text;
        $domobj.style.setProperty('display', 'block');
    });
};

validate.outputValidateError = function (key, checkerror) {
    validate.printValidateError(key, checkerror);
    validate.renderValidateError(key, checkerror);
};

validate.hideValidateError = function () {
    _executeIfOutput(($domobj) => {
        $domobj.style.setProperty('display', 'none');
    });
};

validate.checkOptions = function (options, key) {
    return utility.isHash(options) && key in options;
};

//For validating the base object
validate.validateIsArray = function (key, entry, length) {
    let array_key = _sanitizeKey(key);
    let check = ValidateJS({[array_key]: entry}, {[array_key]: validate.array_constraints(length)});
    if (check !== undefined) {
        validate.outputValidateError(key, check);
        return false;
    }
    return true;
};

validate.validateIsHash = function (key, entry) {
    let hash_key = _sanitizeKey(key);
    let check = ValidateJS({[hash_key]: entry}, {[hash_key]: validate.hash_constraints});
    if (check !== undefined) {
        validate.outputValidateError(key, check);
        return false;
    }
    return true;
};

//For basic objects in an array only, i.e. string, integer, etc.
validate.validateArrayValues = function(key, array, validator) {
    const printer = debug.getFunctionPrint('validate.validateArrayValues');
    for (let i = 0;i < array.length; i++) {
        if (!validator.func(array[i])) {
            let display_key = `${key}[${i}]`;
            let display_item = JSON.stringify(array[i]);
            printer.debuglogLevel(`"${display_key}" ${display_item} is not a valid ${validator.type}.`, debug.INFO);
            return false;
        }
    }
    return true;
};

validate.correctArrayValues = function(key, array, validator) {
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

validate.validateHashEntries = function (key, hash, validator) {
    let check = ValidateJS(hash, validator);
    if (check !== undefined) {
        validate.outputValidateError(key, check);
        return false;
    }
    let extra_keys = utility.arrayDifference(Object.keys(hash), Object.keys(validator));
    if (extra_keys.length) {
        validate.outputValidateError(key, ["Hash contains extra keys.", extra_keys]);
        return false;
    }
    return true;
};

validate.validateHashArrayEntries = function (key, data, constraints) {
    for (let i = 0; i < data.length; i++) {
        if (!validate.validateHashEntries(`${key}[${i}]`, data[i], constraints)) {
            return false;
        }
    }
    return true;
};

//For basic objects in a hash only, i.e. string, integer, etc.
validate.validateHashValues = function(parent_key, hash, validator) {
    const printer = debug.getFunctionPrint('validate.validateHashValues');
    for (let key in hash) {
        if (!validator.func(hash[key])) {
            let display_key = `${parent_key}.${key}`;
            let display_item = JSON.stringify(hash[key]);
            printer.debuglogLevel(`"${display_key}" ${display_item} is not a valid ${validator.type}.`, debug.INFO);
            return false;
        }
    }
    return true;
};

//Custom validators

if ((typeof ValidateJS === 'function') && (typeof ValidateJS.validators === 'object')) {
    ValidateJS.validators.hash = function(value, options) {
        if (options !== false) {
            if (utility.isHash(value)) {
                return;
            }
            return "is not a hash";
        }
    };

    ValidateJS.validators.array = function(value, options, key) {
        if (options !== false) {
            if (!Array.isArray(value)) {
                return "is not an array";
            }
            if (validate.checkOptions(options, 'length')) {
                const usage_messages = {
                    wrongLength: "array is wrong length (should be %{count} items)",
                    tooShort: "array is too short (minimum is %{count} items)",
                    tooLong: "array is too long (maximum is %{count} items)"
                };
                let validator = Object.assign({}, options.length, usage_messages);
                let array_key = _sanitizeKey(key);
                let checkerror = ValidateJS({[array_key]: value}, {[array_key]: {length: validator}});
                if (checkerror !== undefined) {
                    return checkerror[array_key][0].slice(array_key.length + 1);
                }
            }
        }
    };

    ValidateJS.validators.tagentryarray = function(value, options) {
        if (options !== false) {
            if (!Array.isArray(value)) {
                return "is not an array";
            }
            let categories = (validate.checkOptions(options, 'categories') ? options.categories : TAG_CATEGORIES);
            for (let i = 0;i < value.length;i++) {
                if (value[i].length !== 2) {
                    return "must have 2 entries in tag entry [" + i.toString() + "]";
                }
                if (!utility.isString(value[i][0])) {
                    return "must be a string [" + i.toString() + "][0]";
                }
                if (categories.indexOf(value[i][1]) < 0) {
                    return "must be a valid tag category [" + i.toString() + "][1]";
                }
            }
        }
    };

    ValidateJS.validators["boolean"] = function(value, options) {
        if (options !== false) {
            if (utility.isBoolean(value)) {
                return;
            }
            return "is not a boolean";
        }
    };

    ValidateJS.validators.string = function(value, options) {
        if (options !== false) {
            var message = "";
            //Can't use presence validator so must catch it here
            if (value === undefined) {
                return "can't be missing";
            }
            if (utility.isString(value)) {
                return;
            }
            message += "is not a string";
            if (validate.checkOptions(options, 'allowNull')) {
                if (options.allowNull !== true || value === null) {
                    return;
                }
                message += " or null";
            }
            return message;
        }
    };

    ValidateJS.validators.integer = function(value, options) {
        if (options === false) return;
        var message = "";
        //Can't use presence validator so must catch it here
        if (value === undefined) {
            return "can't be missing";
        }
        if (!Number.isInteger(value)) {
            message = "is not an integer";
            if (validate.checkOptions(options, 'allowNull')) {
                if (options.allowNull !== true || value === null) return;
                message += " or null";
            }
        } else if (validate.checkOptions(options, 'greaterThan') && options.greaterThan >= value) {
            message = "is not greater than " + options.greaterThan;
        } else if (validate.checkOptions(options, 'greaterThanOrEqual') && options.greaterThanOrEqual > value) {
            message = "is not greater than or equal to " + options.greaterThanOrEqual;
        } else if (validate.checkOptions(options, 'lessThan') && options.lessThan <= value) {
            message = "is not less than " + options.lessThan;
        } else if (validate.checkOptions(options, 'lessThanOrEqual') && options.lessThanOrEqual < value) {
            message = "is not less than or equal to " + options.lessThanOrEqual;
        }
        return message.length ? message : null;
    };
}

/****PRIVATE DATA****/

//Functions

function _executeIfOutput(func) {
    if (validate.dom_output) {
        let $domobj = document.querySelector(validate.dom_output);
        if ($domobj) {
            func($domobj);
        }
    }
}

function _sanitizeKey(key) {
    //validate.js has unwanted behavior for keys with dots or backslashes in them
    return key.replace(/\./g, ':').replace(/\\/g, '|');
}

/****INITIALIZATION****/

JSPLib.initializeModule('validate');

})((typeof validate !== 'undefined' ? validate : undefined), JSPLib.debug, JSPLib.utility);
