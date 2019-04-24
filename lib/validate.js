/****DEPENDENCIES****/

/**External dependencies**/
// validate.js (optional)
// JSPLib.utility (optional)

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.validate = JSPLib.validate || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});

//Has utility.js been loaded?
JSPLib.utility = JSPLib.utility || {};
JSPLib.utility.setDifference = JSPLib.utility.setDifference || (()=>{return [];});

//Has validate.js been loaded?
window.validate = window.validate || {};
validate.validators = validate.validators || {};

/****GLOBAL VARIABLES****/

JSPLib.validate.dom_output = null;

//Validation constants


JSPLib.validate.hash_constraints = {
    presence: true,
    hash: true
}

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


/****FUNCTIONS****/

//Helper functions

JSPLib.validate.array_constraints = function (length) {
    return {
        presence: true,
        array: (length ? {length: length} : true)
    };
};

JSPLib.validate.arrayentry_constraints = function (length) {
    return {
        expires : JSPLib.validate.expires_constraints,
        value: JSPLib.validate.array_constraints(length)
    };
};

JSPLib.validate.inclusion_constraints = function (array) {
    return { presence: true, inclusion: array };
};

JSPLib.validate.printValidateError = function (key,checkerror) {
    JSPLib.debug.debuglogLevel(key,':\r\n',JSON.stringify(checkerror,null,2),JSPLib.debug.INFO);
};

JSPLib.validate.renderValidateError = function (key,checkerror) {
    JSPLib.validate._executeIfOutput(($domobj)=>{
        let output_text = `<b>${key}:</b>\r\n<pre>${JSON.stringify(checkerror,null,2)}</pre>`;
        $domobj.innerHTML = output_text;
        $domobj.style.setProperty('display','block');
    });
};

JSPLib.validate.outputValidateError = function (key,checkerror) {
    JSPLib.validate.printValidateError(key,checkerror);
    JSPLib.validate.renderValidateError(key,checkerror);
};

JSPLib.validate.hideValidateError = function () {
    JSPLib.validate._executeIfOutput(($domobj)=>{
        $domobj.style.setProperty('display','none');
    });
}

JSPLib.validate.checkOptions = function (options,key) {
    return validate.isHash(options) && key in options;
};

//For validating the base object
JSPLib.validate.validateIsArray = function (key,entry,length) {
    let array_key = JSPLib.validate._sanitizeKey(key);
    let check = validate({[array_key]: entry}, {[array_key]: JSPLib.validate.array_constraints(length)});
    if (check !== undefined) {
        JSPLib.validate.outputValidateError(key,check);
        return false;
    }
    return true;
}

JSPLib.validate.validateIsHash = function (key,entry) {
    let hash_key = JSPLib.validate._sanitizeKey(key);
    let check = validate({[hash_key]: entry}, {[hash_key]: JSPLib.validate.hash_constraints});
    if (check !== undefined) {
        JSPLib.validate.outputValidateError(key,check);
        return false;
    }
    return true;
}

//For basic objects in an array only, i.e. string, integer, etc.
JSPLib.validate.validateArrayValues = function (key,array,validator) {
    for (let i = 0;i < array.length; i++) {
        let display_key = `${key}[${i}]`;
        let index_key = JSPLib.validate._sanitizeKey(display_key);
        let check = validate({[index_key]: array[i]},{[index_key]: validator});
        if (check !== undefined) {
            JSPLib.validate.outputValidateError(display_key,check);
            return false;
        }
    }
    return true;
}

JSPLib.validate.validateHashEntries = function (key,hash,validator) {
    let check = validate(hash,validator);
    if (check !== undefined) {
        JSPLib.validate.outputValidateError(key,check);
        return false;
    }
    let extra_keys = JSPLib.utility.setDifference(Object.keys(hash),Object.keys(validator));
    if (extra_keys.length) {
        JSPLib.validate.outputValidateError(key,["Hash contains extra keys.",extra_keys]);
        return false;
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
            let array_key = JSPLib.validate._sanitizeKey(key);
            let checkerror = validate({[array_key]:value},{[array_key]:{length: validator}});
            if (checkerror !== undefined) {
                return checkerror[array_key][0].slice(array_key.length+1);
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
};

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
    return Array.isArray(array) && ((array.length === 0) || ((array.length > 0) && array.reduce((total,val)=>{return JSPLib.validate.validateID(val) && total;},true)));
};

//Private functions

JSPLib.validate._executeIfOutput = function (func) {
    if (JSPLib.validate.dom_output) {
        var $domobj = document.querySelector(JSPLib.validate.dom_output);
        if ($domobj) {
            func($domobj);
        }
    }
};

//validate.js has unwanted behavior for keys with dots in them
JSPLib.validate._sanitizeKey = function (key) {
    return key.replace(/\./g,':');
};
