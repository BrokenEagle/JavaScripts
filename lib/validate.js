/****DEPENDENCIES****/

/**External dependencies**/
// validate.js (optional)

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.validate = JSPLib.validate || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});

//Has validate.js been loaded?
window.validate = window.validate || {};
validate.validators = validate.validators || {};

/****GLOBAL VARIABLES****/

//Validation constants


JSPLib.validate.hash_constraints = {
    presence: true,
    hash: true
}

JSPLib.validate.array_constraints = {
        presence: true,
        array: true
};

JSPLib.validate.boolean_constraints = {
    presence: true,
    boolean: true
}

JSPLib.validate.number_constraints = {
    presence: true,
    numericality: true
}

JSPLib.validate.integer_constraints = {
    presence: true,
    numericality: {
        noStrings: true,
        onlyInteger: true
    }
};

JSPLib.validate.counting_constraints = {
    presence: true,
    numericality: {
        noStrings: true,
        onlyInteger: true,
        greaterThan: -1,
    }
};

JSPLib.validate.postcount_constraints = {
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

JSPLib.validate.tagentryarray_constraints = {
    presence: true,
    tagentryarray: true
};

JSPLib.validate.hashentry_constraints = {
    expires : JSPLib.validate.expires_constraints,
    value: JSPLib.validate.hash_constraints
};

JSPLib.validate.arrayentry_constraints = {
    expires : JSPLib.validate.expires_constraints,
    value: JSPLib.validate.array_constraints
};

/****FUNCTIONS****/

//Helper functions

JSPLib.validate.inclusion_constraints = function (array) {
    return { presence: true, inclusion: array };
};

JSPLib.validate.printValidateError = function (key,checkerror) {
    JSPLib.debug.debuglogLevel(key,':\r\n',JSON.stringify(checkerror,null,2),JSPLib.debug.INFO);
};

JSPLib.validate.checkOptions = function (options,key) {
    return validate.isHash(options) && key in options;
};

//For validating the base object
JSPLib.validate.validateIsArray = function (key,entry,length) {
    let array_validator = {
        presence: true,
        array: (length ? {length: length} : true)
     };
    let check = validate({value: entry}, {value: array_validator});
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    return true;
}

JSPLib.validate.validateIsHash = function (key,entry) {
    let check = validate({value: entry}, {value: JSPLib.validate.hash_constraints});
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    return true;
}

//For basic objects in an array only, i.e. string, integer, etc.
JSPLib.validate.validateArrayValues = function (key,array,validator) {
    for (let i = 0;i < array.length; i++) {
        let check = validate({value: array[i]},{value: validator});
        if (check !== undefined) {
            JSPLib.debug.debuglog(key,`[${i}]`,array[i]);
            JSPLib.validate.printValidateError(key,check);
            return false;
        }
    }
    return true;
}

//Custom validators

validate.validators.hash = function(value, options, key, attributes) {
    if (options !== false) {
        if (validate.isHash(value)) {
            return;
        }
        return "is not a hash";
    }
};

validate.validators.array = function(value, options, key, attributes) {
    if (options !== false) {
        if (!validate.isArray(value)) {
            return "is not an array";
        }
        if (JSPLib.validate.checkOptions(options,'length')) {
            const usage_messages = {
                wrongLength: "array is wrong length (should be %{count} items)",
                tooShort: "array is too short (minimum is %{count} items)",
                tooLong : "array is too long (maximum is %{count} items)"
            };
            let validator = Object.assign({},options.length,usage_messages);
            let checkerror = validate({[key]:value},{[key]:{length: validator}});
            if (checkerror !== undefined) {
                return JSON.stringify(checkerror,null,2);
            }
        }
    }
};

validate.validators.tagentryarray = function(value, options, key, attributes) {
    if (options !== false) {
        if (!validate.isArray(value)) {
            return "is not an array";
        }
        for (let i=0;i < value.length;i++) {
            if (value[i].length !== 2) {
                return "must have 2 entries in tag entry ["+i.toString()+"]";
            }
            if (!validate.isString(value[i][0])) {
                return "must be a string ["+i.toString()+"][0]";
            }
            if ([0,1,3,4,5].indexOf(value[i][1]) < 0) {
                return "must be a valid tag category ["+i.toString()+"][1]";
            }
        }
    }
};

validate.validators.boolean = function(value, options, key, attributes) {
    if (options !== false) {
        if (validate.isBoolean(value)) {
            return;
        }
        return "is not a boolean";
    }
};

validate.validators.string = function(value, options, key, attributes) {
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
        if (JSPLib.validate.checkOptions(options,'allowNull')) {
            if (options.allowNull !== true || value === null) {
                return;
            }
            message += " or null";
        }
        return message;
    }
};

//Standalone base-type validators

JSPLib.validate.validateExpires = function (actual_expires,expected_expires) {
    //Resolve to false if the actual_expires is bogus, has expired, or the expiration is too long
    return Number.isInteger(actual_expires) && (Date.now() <= actual_expires) && (!Number.isInteger(expected_expires) || ((actual_expires - Date.now()) <= expected_expires));
}

JSPLib.validate.validateID = function (num) {
    return Number.isInteger(num) && (num > 0);
}

JSPLib.validate.validateIDList = function (array) {
    return Array.isArray(array) && (array.length > 0) && array.reduce((total,val)=>{return JSPLib.validate.validateID(val) && total;},true);
}
