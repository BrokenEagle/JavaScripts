/****SETUP****/

//Has debug.js been loaded?
if (debuglog === undefined) {
    var debuglog = ()=>{};
}

/****GLOBAL VARIABLES****/

//Validation constants

const postcount_constraints = {
    presence: true,
    numericality: {
        noStrings: true,
        onlyInteger: true,
        greaterThan: 0,
    }
};

const expires_constraints = {
    presence: true,
    numericality: {
        onlyInteger: true,
        greaterThan: 0,
    }
};

const stringonly_constraints = {
    string: true
};

const tagentryarray_constraints = {
    presence: true,
    tagentryarray: true
};

/****FUNCTIONS****/

//Helper functions

function inclusion_constraints(array) {
    return { presence: true, inclusion: array };
}

function printValidateError(key,checkerror) {
    debuglog(key,':\r\n',JSON.stringify(checkerror,null,2));
}

//Custom validators

validate.validators.array = function(value, options, key, attributes) {
    if (options !== false) {
        if (!validate.isArray(value)) {
            return "is not an array";
        }
        if (options !== true && 'length' in options) {
            let checkerror = validate({val:value},{val:{length: options.length}});
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
        if (validate.isHash(options) && 'allowNull' in options && options.allowNull === true) {
            if (value === null) {
                return;
            }
            message += " or null";
        }
        return message;
    }
};
