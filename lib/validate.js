/****DEPENDENCIES****/

/**External dependencies**/
// validate.js (optional)

/**Internal dependencies**/
// JSPLib.Debug (optional)
// JSPLib.Utility

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function ({ValidateJS, Debug, Utility}) {

const Validate = JSPLib.Validate;

/****GLOBAL VARIABLES****/

Validate.dom_output = null;

/****PRIVATE VARIABLES****/

const TAG_CATEGORIES = [0, 1, 3, 4, 5];

//Validation constants

Validate.hash_constraints = {
    presence: true,
    hash: true
};

Validate.boolean_constraints = {
    presence: true,
    boolean: true
};

Validate.number_constraints = {
    presence: true,
    numericality: true
};

Validate.integer_constraints = {
    integer: true,
};

Validate.counting_constraints = Validate.timestamp_constraints = Validate.expires_constraints = {
    integer: {
        greaterThanOrEqual: 0,
    },
};

Validate.id_constraints = Validate.postcount_constraints = {
    integer: {
        greaterThan: 0,
    },
};

Validate.stringonly_constraints = {
    string: true
};

Validate.stringnull_constraints = {
    string: {
        allowNull: true
    }
};

Validate.hashentry_constraints = {
    expires: Validate.expires_constraints,
    value: Validate.hash_constraints
};

Validate.basic_number_validator = {
    func: ((value) => typeof value === "number"),
    type: "number"
};

Validate.basic_integer_validator = {
    func: Number.isInteger,
    type: "integer"
};

Validate.basic_ID_validator = {
    func: ((value) => Number.isInteger(value) && (value > 0)),
    type: "ID"
};

Validate.basic_stringonly_validator = {
    func: ((value) => typeof value === "string"),
    type: "string"
};

/****FUNCTIONS****/

//Helper functions

Validate.string_constraints = function (string = true, length) {
    let string_constraint = (string ? {string} : {});
    let length_constraint = (length ? {length} : {});
    return Object.assign(string_constraint, length_constraint);
};

Validate.array_constraints = function (length) {
    return {
        presence: true,
        array: (length ? {length} : true)
    };
};

Validate.arrayentry_constraints = function (length) {
    return {
        expires: Validate.expires_constraints,
        value: Validate.array_constraints(length)
    };
};

Validate.tagentryarray_constraints = function(categories) {
    let option = (Array.isArray(categories) ? {categories} : true);
    return {
        presence: true,
        tagentryarray: option
    };
};

Validate.inclusion_constraints = function (array) {
    return { presence: true, inclusion: array };
};

Validate.printValidateError = function (key, checkerror) {
    const printer = Debug.getFunctionPrint('Validate.printValidateError');
    printer.logLevel(key, ':\r\n', JSON.stringify(checkerror, null, 2), Debug.INFO);
};

Validate.renderValidateError = function (key, checkerror) {
    _executeIfOutput(($domobj) => {
        let output_text = `<b>${key}:</b>\r\n<pre>${JSON.stringify(checkerror, null, 2)}</pre>`;
        $domobj.innerHTML = output_text;
        $domobj.style.setProperty('display', 'block');
    });
};

Validate.outputValidateError = function (key, checkerror) {
    Validate.printValidateError(key, checkerror);
    Validate.renderValidateError(key, checkerror);
};

Validate.hideValidateError = function () {
    _executeIfOutput(($domobj) => {
        $domobj.style.setProperty('display', 'none');
    });
};

Validate.checkOptions = function (options, key) {
    return Utility.isHash(options) && key in options;
};

//For validating the base object
Validate.validateIsArray = function (key, entry, length) {
    let array_key = _sanitizeKey(key);
    let check = ValidateJS({[array_key]: entry}, {[array_key]: Validate.array_constraints(length)});
    if (check !== undefined) {
        Validate.outputValidateError(key, check);
        return false;
    }
    return true;
};

Validate.validateIsHash = function (key, entry) {
    let hash_key = _sanitizeKey(key);
    let check = ValidateJS({[hash_key]: entry}, {[hash_key]: Validate.hash_constraints});
    if (check !== undefined) {
        Validate.outputValidateError(key, check);
        return false;
    }
    return true;
};

//For basic objects in an array only, i.e. string, integer, etc.
Validate.validateArrayValues = function(key, array, validator) {
    const printer = Debug.getFunctionPrint('Validate.validateArrayValues');
    for (let i = 0;i < array.length; i++) {
        if (!validator.func(array[i])) {
            let display_key = `${key}[${i}]`;
            let display_item = JSON.stringify(array[i]);
            printer.logLevel(`"${display_key}" ${display_item} is not a valid ${validator.type}.`, Debug.INFO);
            return false;
        }
    }
    return true;
};

Validate.correctArrayValues = function(key, array, validator) {
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

Validate.validateHashEntries = function (key, hash, validator) {
    let check = ValidateJS(hash, validator);
    if (check !== undefined) {
        Validate.outputValidateError(key, check);
        return false;
    }
    let extra_keys = Utility.arrayDifference(Object.keys(hash), Object.keys(validator));
    if (extra_keys.length) {
        Validate.outputValidateError(key, ["Hash contains extra keys.", extra_keys]);
        return false;
    }
    return true;
};

Validate.validateHashArrayEntries = function (key, data, constraints) {
    for (let i = 0; i < data.length; i++) {
        if (!Validate.validateHashEntries(`${key}[${i}]`, data[i], constraints)) {
            return false;
        }
    }
    return true;
};

//For basic objects in a hash only, i.e. string, integer, etc.
Validate.validateHashValues = function(parent_key, hash, validator) {
    const printer = Debug.getFunctionPrint('Validate.validateHashValues');
    for (let key in hash) {
        if (!validator.func(hash[key])) {
            let display_key = `${parent_key}.${key}`;
            let display_item = JSON.stringify(hash[key]);
            printer.logLevel(`"${display_key}" ${display_item} is not a valid ${validator.type}.`, Debug.INFO);
            return false;
        }
    }
    return true;
};

//Custom validators

if ((typeof ValidateJS === 'function') && (typeof ValidateJS.validators === 'object')) {
    // Debug mode will either be set or it won't during the synchronous portion, so just set a short timeout and check it then.
    setTimeout((() => Debug.logLevel("Validate.js detected... custom validators installed.", Debug.INFO)), 1);

    ValidateJS.validators.hash = function(value, options) {
        if (options !== false) {
            if (Utility.isHash(value)) {
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
            if (Validate.checkOptions(options, 'length')) {
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
            let categories = (Validate.checkOptions(options, 'categories') ? options.categories : TAG_CATEGORIES);
            for (let i = 0;i < value.length;i++) {
                if (value[i].length !== 2) {
                    return "must have 2 entries in tag entry [" + i.toString() + "]";
                }
                if (!Utility.isString(value[i][0])) {
                    return "must be a string [" + i.toString() + "][0]";
                }
                if (categories.indexOf(value[i][1]) < 0) {
                    return "must be a valid tag category [" + i.toString() + "][1]";
                }
            }
        }
    };

    // eslint-disable-next-line dot-notation
    ValidateJS.validators.boolean = function(value, options) {
        if (options !== false) {
            if (Utility.isBoolean(value)) {
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
            if (Utility.isString(value)) {
                return;
            }
            message += "is not a string";
            if (Validate.checkOptions(options, 'allowNull')) {
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
            if (Validate.checkOptions(options, 'allowNull')) {
                if (options.allowNull !== true || value === null) return;
                message += " or null";
            }
        } else if (Validate.checkOptions(options, 'greaterThan') && options.greaterThan >= value) {
            message = "is not greater than " + options.greaterThan;
        } else if (Validate.checkOptions(options, 'greaterThanOrEqual') && options.greaterThanOrEqual > value) {
            message = "is not greater than or equal to " + options.greaterThanOrEqual;
        } else if (Validate.checkOptions(options, 'lessThan') && options.lessThan <= value) {
            message = "is not less than " + options.lessThan;
        } else if (Validate.checkOptions(options, 'lessThanOrEqual') && options.lessThanOrEqual < value) {
            message = "is not less than or equal to " + options.lessThanOrEqual;
        }
        return message.length ? message : null;
    };
}

/****PRIVATE DATA****/

//Functions

function _executeIfOutput(func) {
    if (Validate.dom_output) {
        let $domobj = document.querySelector(Validate.dom_output);
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

JSPLib.initializeModule('Validate');

})(JSPLib);
