/****DEPENDENCIES****/

/**External dependencies**/
// jQuery (optional)

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.utility = JSPLib.utility || {};

/****GLOBAL VARIABLES****/

JSPLib.utility.cssstyle = {};
JSPLib.utility.csssheet = {};
JSPLib.utility.scriptfile = {};
JSPLib.utility.max_column_characters = 20;

//Time constants

JSPLib.utility.one_second = 1000;
JSPLib.utility.one_minute = JSPLib.utility.one_second * 60;
JSPLib.utility.one_hour = JSPLib.utility.one_minute * 60;
JSPLib.utility.one_day = JSPLib.utility.one_hour * 24;
JSPLib.utility.one_week = JSPLib.utility.one_day * 7;
JSPLib.utility.one_month = JSPLib.utility.one_day * 30;
JSPLib.utility.one_year = JSPLib.utility.one_day * 365;

/****FUNCTIONS****/

//Time functions

JSPLib.utility.sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

JSPLib.utility.getExpiration = function (expires) {
    return Date.now() + expires;
}

//Boolean functions

JSPLib.utility.not = function (data,reverse) {
    return (reverse ? !Boolean(data) : Boolean(data));
}

//Number functions

JSPLib.utility.setPrecision = function (number,precision) {
    return parseFloat(number.toFixed(precision));
};

//String functions

JSPLib.utility.titleizeString = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

JSPLib.utility.maxLengthString = function (string) {
    if (string.length > JSPLib.utility.max_column_characters) {
        string = string.slice(0,JSPLib.utility.max_column_characters-1) + '…';
    }
    return string;
};

JSPLib.utility.regexpEscape = function (string) {
    return string.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

JSPLib.utility.kebabCase = function (string) {
    return string.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g,'-').toLowerCase();
};

JSPLib.utility.camelCase = function (string) {
    return string.replace(/-([a-z])/g,(all,letter)=>{return letter.toUpperCase()});
};

JSPLib.utility.displayCase = function (string) {
    return JSPLib.utility.titleizeString(string.toLowerCase().replace(/[_]/g,' '));
};

//String array functions

JSPLib.utility.filterRegex = function (array,regex,reverse=false) {
    return array.filter(entry=>{return JSPLib.utility.not(entry.match(regex),reverse);});
};

JSPLib.utility.filterEmpty = function (array) {
    return JSPLib.utility.filterRegex(array,/[\s\S]+/);
};

//Array functions

JSPLib.utility.setUnique = function (array) {
    return array.filter((value,index,self)=>{return self.indexOf(value) === index;});
};

JSPLib.utility.setDifference = function (array1,array2) {
    return array1.filter(value=>{return array2.indexOf(value) < 0;});
};

JSPLib.utility.setIntersection = function (array1,array2) {
    return array1.filter(value=>{return array2.indexOf(value) >= 0;});
};

JSPLib.utility.setUnion = function (array1,array2) {
    return JSPLib.utility.setUnique(array1.concat(array2));
};

JSPLib.utility.setSymmetricDifference = function (array1,array2) {
    return JSPLib.utility.setDifference(JSPLib.utility.setUnion(array1,array2),JSPLib.utility.setIntersection(array1,array2));
};

//Filter a list of objects with a list of values
JSPLib.utility.listFilter = function (array,itemlist,itemkey,reverse=false) {
    return array.filter((item)=>{return JSPLib.utility.not(itemlist.includes(item[itemkey]),reverse);});
}

//Object functions

JSPLib.utility.getObjectAttributes = function (array,attribute) {
    return array.map(val=>{return val[attribute];});
};

//Deep copy an object or array
JSPLib.utility.dataCopy = function (olddata) {
  if (!olddata) {
    return olddata;
  }
  let newdata = Array.isArray(olddata) ? [] : {};
  for (let key in olddata) {
    let value = olddata[key];
    newdata[key] = (typeof value === "object") ? JSPLib.utility.dataCopy(value) : value;
  }
  return newdata;
};

//Function functions

JSPLib.utility.hijackFunction = function (oldfunc,newfunc) {
    return function() {
        let data = oldfunc(...arguments);
        data = newfunc(data,...arguments);
        return data;
    }
};

JSPLib.utility.initializeInterval = function (func,time) {
    func();
    return setInterval(func,time);
};

//DOM functions

JSPLib.utility.DOMtoArray = function (obj) {
  var array = [];
  for (let i = obj.length; i--;) {
    array[i] = obj[i];
  }
  return array;
}

JSPLib.utility.DOMtoHash = function (obj) {
  var hash = {};
  for (let key in obj) {
    hash[key] = obj[key];
  }
  return hash;
}

JSPLib.utility.installScript = function (url) {
    if ('jQuery' in window) {
        //If jQuery is available, it returns a promise which can be used to check for script install
        return jQuery.ajax({
            url: url,
            dataType: "script",
            cache: true
        });
    } else {
        //Otherwise, the calling script will need to test for script install some other way
        let script = document.createElement('script');
        script.src = url;
        document.head.appendChild(script);
    }
};

JSPLib.utility.getExpando = function (private_data) {
    if (private_data) {
        return window.jQuery && jQuery.expando + '1';
    } else {
        return window.jQuery && jQuery.expando + '2';
    }
};

JSPLib.utility.getPrivateData = function ($dom_object) {
    if ($dom_object) {
        let private_expando = JSPLib.utility.getExpando(true);
        if (private_expando && private_expando in $dom_object) {
            return $dom_object[private_expando];
        }
    }
    return {};
};

JSPLib.utility.getPublicData = function ($dom_object) {
    if ($dom_object) {
        let public_expando = JSPLib.utility.getExpando(false);
        if (public_expando && public_expando in $dom_object) {
            return $dom_object[public_expando];
        } else {
            return JSPLib.utility.getDataAttributes($dom_object);
        }
    }
    return {};
};

JSPLib.utility.getDataAttributes = function ($dom_object) {
    let dataset = JSPLib.utility.DOMtoHash($dom_object.dataset);
    for (let key in dataset) {
        try {
            dataset[key] = JSON.parse(dataset[key]);
        } catch (e) {
            //swallow
        }
    }
    return dataset;
};

JSPLib.utility.getBoundEventNames = function (selector,eventtype) {
    let $obj = document.querySelector(selector);
    if ($obj === null) {
        return [];
    }
    let private_data = JSPLib.utility.getPrivateData($obj);
    let boundevents = 'events' in private_data && private_data.events;
    if (!boundevents || !(eventtype in boundevents)) {
        return [];
    }
    return boundevents[eventtype].map((entry)=>{return entry.namespace;});
};

JSPLib.utility.isNamespaceBound = function (selector,eventtype,namespace) {
    let namespaces = JSPLib.utility.getBoundEventNames(selector,eventtype);
    return namespaces.includes(namespace);
};

JSPLib.utility.getDOMDataKeys = function (selector) {
    let $obj = document.querySelector(selector);
    return Object.keys(JSPLib.utility.getPublicData($obj));
};

JSPLib.utility.hasDOMDataKey = function (selector,key) {
    return JSPLib.utility.getDOMDataKeys(selector).includes(key);
};

JSPLib.utility.addStyleSheet = function (url,title='') {
    if (title in JSPLib.utility.csssheet) {
        JSPLib.utility.csssheet[title].href = url;
    } else {
        JSPLib.utility.csssheet[title] = document.createElement('link');
        JSPLib.utility.csssheet[title].rel = 'stylesheet';
        JSPLib.utility.csssheet[title].type = 'text/css';
        JSPLib.utility.csssheet[title].href = url;
        document.head.appendChild(JSPLib.utility.csssheet[title]);
    }
};

//Sets the css style and retains a pointer to the DOM object for later edits
JSPLib.utility.setCSSStyle = function (csstext,title) {
    if (title in JSPLib.utility.cssstyle) {
        JSPLib.utility.cssstyle[title].innerHTML = csstext;
    } else {
        JSPLib.utility.cssstyle[title] = document.createElement('style');
        JSPLib.utility.cssstyle[title].type = 'text/css';
        JSPLib.utility.cssstyle[title].innerHTML = csstext;
        document.head.appendChild(JSPLib.utility.cssstyle[title]);
    }
};

JSPLib.utility.fullHide = function (selector) {
    let $objs = document.querySelectorAll(selector);
    for (let i = 0; i < $objs.length; i++) {
        $objs[i].style.setProperty('display','none','important');
    }
}

JSPLib.utility.clearHide = function (selector) {
    let $objs = document.querySelectorAll(selector);
    for (let i = 0; i < $objs.length; i++) {
        $objs[i].style.setProperty('display','');
    }
}

JSPLib.utility.getMeta = function (key) {
    let $obj = document.querySelector("meta[name=" + key + "]");
    return $obj && $obj.content;
}

JSPLib.utility.getNthParent = function (obj,levels) {
    let $element = obj;
    for (let i=0;i<levels;i++) {
        $element = $element.parentElement;
    }
    return $element;
}

//Number is one-based, i.e. the first child is number 1, the last child is -1
JSPLib.utility.getNthChild = function (obj,number) {
    let child_pos = (number < 0 ? obj.children.length + number : number - 1);
    return obj.children[child_pos];
}

JSPLib.utility.getNthSibling = function (obj,vector) {
    let $element = obj;
    let distance = Math.abs(vector);
    for (let i=0;i<distance;i++) {
        $element = (vector > 0 ? $element.nextElementSibling : $element.previousElementSibling);
    }
    return $element;
}

//Two dimensional array where each entry is a two-entry vector
//vectors[0]: moves at the same hierarchy level, i.e. siblings
//vectors[1]: move to different hierarchy levels, i.e. ancestors/descendants
//No diagonal vectors, i.e. the first or second entry must be 0
//Going to descendants must be done one vector at a time
JSPLib.utility.walkDOM = function (obj,vectors) {
    let $element = obj;
    for (let vector of vectors) {
        if ((vector[0] !== 0) && (vector[1] !== 0)) {
            continue; //invalid vector
        } else if (vector[0] !== 0) {
            $element = JSPLib.utility.getNthSibling($element, vector[0]);
        } else if (vector[1] < 0) {
            $element = JSPLib.utility.getNthParent($element, Math.abs(vector[1]));
        } else if (vector[1] > 0) {
            $element = JSPLib.utility.getNthChild($element, vector[1]);
        }
    }
    return $element;
}

//Cookie functions

JSPLib.utility.createCookie = function (name, value, days) {
    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * JSPLib.utility.one_day));
        expires = "; expires=" + date.toGMTString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
}

JSPLib.utility.readCookie = function (name) {
    let name_equals = name + "=";
    let all_cookies = document.cookie.split(';');
    for (let i = 0; i < all_cookies.length; i++) {
        let cookie = all_cookies[i].trim();
        if (cookie.indexOf(name_equals) == 0) {
            return decodeURIComponent(cookie.substring(name_equals.length, cookie.length).replace(/\+/g, " "));
        }
    }
    return null;
}

 JSPLib.utility.eraseCookie = function (name) {
    JSPLib.utility.createCookie(name, "", -1);
}
