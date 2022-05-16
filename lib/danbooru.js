/****DEPENDENCIES****/

/**External dependencies**/
// jQuery

/**Internal dependencies**/
// JSPLib.utility
// JSPLib.network

/****SETUP****/

//Linter configuration
/* global JSPLib Danbooru */

JSPLib.danbooru = {};

/****GLOBAL VARIABLES****/

JSPLib.danbooru.num_network_requests = 0;
JSPLib.danbooru.max_network_requests = 25;

/****FUNCTIONS****/

JSPLib.danbooru.submitRequest = async function (self, type, url_addons = {}, {default_val = null, long_format = false, key, domain = '', notify = false} = {}) {
    key = key || String(JSPLib.utility.getUniqueID());
    if (this.num_network_requests >= this.max_network_requests) {
        await JSPLib.network.rateLimit('danbooru');
    }
    self.debug('logLevel', {type, url_addons, default_val, long_format, key, domain, notify}, JSPLib.debug.VERBOSE);
    JSPLib.network.incrementCounter('danbooru');
    JSPLib.debug.recordTime(key, 'Network');
    if (long_format) {
        url_addons._method = 'get';
    }
    let func = (long_format ? JSPLib.network.post : JSPLib.network.getJSON);
    //The network module functions use the module this, so restore the correct this that was broken when assigned to a variable
    return func.apply(JSPLib.network, [`${domain}/${type}.json`, {data: url_addons}])
        .always(() => {
            JSPLib.debug.recordTimeEnd(key, 'Network');
            JSPLib.network.decrementCounter('danbooru');
        })
        .then(
            //Success (return data)
            (data) => data,
            //Failure (return default)
            (error) => {
                error = JSPLib.network.processError(error, "danbooru.submitRequest");
                let error_key = `${domain}/${type}.json?${JSPLib._jQuery.param(url_addons)}`;
                JSPLib.network.logError(error_key, error);
                if (notify) {
                    JSPLib.network.notifyError(error);
                }
                return default_val;
            }
        );
};

JSPLib.danbooru.getAllItems = async function (self, type, limit, {url_addons = {}, batches = null, reverse = false, long_format = false, page = null, domain = "", domname = null, notify = false} = {}) {
    self.debug('logLevel', {type, limit, url_addons, batches, reverse, long_format, page, domain, domname, notify}, JSPLib.debug.VERBOSE);
    let page_modifier = (reverse ? 'a' : 'b');
    let page_addon = (Number.isInteger(page) ? {page: `${page_modifier}${page}`} : {});
    let limit_addon = {limit};
    let batch_num = 1;
    var return_items = [];
    await this.initializePageCounter(type, limit, url_addons, reverse, long_format, page, domain, domname, notify);
    while (true) {
        let request_addons = JSPLib.utility.joinArgs(url_addons, page_addon, limit_addon);
        let temp_items = await this.submitRequest(type, request_addons, {default_val: [], long_format, domain, notify});
        return_items = JSPLib.utility.concat(return_items, temp_items);
        let lastid = this.getNextPageID(temp_items, reverse);
        this.updatePageCounter(domname, limit, lastid);
        if (temp_items.length < limit || (batches && batch_num >= batches)) {
            return return_items;
        }
        page_addon = {page: `${page_modifier}${lastid}`};
        self.debug('logLevel', "#", batch_num++, "Rechecking", type, "@", lastid, JSPLib.debug.INFO);
    }
};

JSPLib.danbooru.getPostsCountdown = async function (self, query, limit, only, domname) {
    self.debug('logLevel', {query, limit, only, domname}, JSPLib.debug.VERBOSE);
    let tag_addon = {tags: query};
    let only_addon = (only ? {only} : {});
    let limit_addon = {limit};
    let page_addon = {};
    var return_items = [];
    let page_num = 1;
    var counter;
    if (domname) {
        let count_resp = await this.submitRequest('counts/posts', tag_addon, {default_val: {counts: {posts: 0}}});
        try {
            counter = Math.ceil(count_resp.counts.posts / limit);
        } catch (e) {
            self.debug('warnLevel', "Malformed count response", count_resp, e, JSPLib.debug.ERROR);
            counter = '<span title="Malformed count response" style="color:red">Error!</span>';
        }
    }
    while (true) {
        if (domname) {
            JSPLib._jQuery(domname).html(counter);
        }
        if (Number.isInteger(counter)) {
            self.debug('logLevel', "Pages left #", counter--, JSPLib.debug.INFO);
        } else {
            self.debug('logLevel', "Pages done #", page_num++, JSPLib.debug.INFO);
        }
        let request_addons = JSPLib.utility.joinArgs(tag_addon, limit_addon, only_addon, page_addon);
        let request_key = 'posts-' + JSPLib._jQuery.param(request_addons);
        let temp_items = await this.submitRequest('posts', request_addons, {default_val: [], key: request_key});
        return_items = JSPLib.utility.concat(return_items, temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = this.getNextPageID(temp_items, false);
        page_addon = {page: `b${lastid}`};
    }
};

//Helper functions

JSPLib.danbooru.getNextPageID = function (array, reverse) {
    let ChooseID = (reverse ? Math.max : Math.min);
    let valid_items = array.filter((val) => ('id' in val));
    return ChooseID(...valid_items.map((val) => val.id));
};

//Counter functions

JSPLib.danbooru.initializePageCounter = async function (self, type, limit, url_addons, reverse, long_format, page, domain, domname, notify) {
    if (domname && Number.isInteger(page)) {
        let latest_id = JSPLib._jQuery(domname).data('latest-id');
        if (!Number.isInteger(latest_id)) {
            let request_addons = JSPLib.utility.joinArgs(url_addons, {limit: 1}, {only: 'id'});
            if (!reverse) {
                request_addons.page = 'a0';
            }
            let latest_item = await this.submitRequest(type, request_addons, {default_val: [], long_format, domain, notify});
            if (latest_item.length) {
                latest_id = latest_item[0].id;
                let current_counter = Math.abs(Math.ceil((latest_id - page) / limit));
                JSPLib._jQuery(domname).text(current_counter);
                JSPLib._jQuery(domname).data('latest-id', latest_id);
                self.debug('logLevel', current_counter, latest_id, page, JSPLib.debug.INFO);
            }
        }
    }
};

JSPLib.danbooru.updatePageCounter = function (self, domname, limit, page) {
    if (domname) {
        let latest_id = JSPLib._jQuery(domname).data('latest-id');
        if (Number.isInteger(latest_id)) {
            let current_counter = (Number.isInteger(page) ? Math.abs(Math.ceil((latest_id - page) / limit)) : 0);
            JSPLib._jQuery(domname).text(current_counter);
            self.debug('logLevel', current_counter, latest_id, page, JSPLib.debug.INFO);
        }
    }
};

//Tag functions

JSPLib.danbooru.getShortName = function (category) {
    let shortnames = ['art', 'char', 'copy', 'gen', 'meta'];
    for (let i = 0;i < shortnames.length ; i++) {
        if (category.search(RegExp(shortnames[i])) === 0) {
            return shortnames[i];
        }
    }
};

JSPLib.danbooru.randomDummyTag = function () {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    var result = '';
    for (var i = 8; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return 'dummytag-' + result;
};

JSPLib.danbooru.tagOnlyRegExp = function (str) {
    return RegExp('^' + str.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1") + '$', 'i');
};

//Note: Currently doesn't work on Firefox
JSPLib.danbooru.tagRegExp = function (str) {
    return RegExp('(?<=(?:^|\\s))' + str.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1") + '(?=(?:$|\\s))', 'gi');
};

//Page functions

JSPLib.danbooru.getModel = function() {
    let partial_model = JSPLib.utility.camelCase(document.body.dataset.controller).replace(/i?e?s$/, '');
    let model_keys = Object.keys(document.body.dataset).filter((val) => val.match(new RegExp(partial_model)));
    if (model_keys.length === 0) {
        return null;
    }
    return JSPLib.utility.kebabCase(model_keys[0]).replace(/-[a-z]+$/, '');
};

JSPLib.danbooru.getShowID = function() {
    if (document.body.dataset.action !== "show") {
        return 0;
    }
    let model = this.getModel();
    if (model === null) {
        return 0;
    }
    let show_key = JSPLib.utility.camelCase(model) + 'Id';
    return Number(document.body.dataset[show_key]) || 0;
};

JSPLib.danbooru.isProfilePage = function() {
    return (document.body.dataset.controller === "users") && (document.body.dataset.action === "show") && (this.getShowID() === Danbooru.CurrentUser.data('id'));
};

JSPLib.danbooru.isSettingMenu = function () {
    return (document.body.dataset.controller === "users") && (document.body.dataset.action === "edit");
};

//Render functions

JSPLib.danbooru.postSearchLink = function (tag_string, text, options = "") {
    let tag_param = JSPLib._jQuery.param({tags: tag_string}).replace(/%20/g, '+');
    return `<a ${options} href="/posts?${tag_param}">${text}</a>`;
};

JSPLib.danbooru.wikiLink = function (tag, text, options = "") {
    return `<a ${options} href="/wiki_pages/${encodeURIComponent(tag)}">${text}</a>`;
};

/****PRIVATE DATA****/

//NONE

/****INITIALIZATION****/

JSPLib.danbooru._configuration = {
    nonenumerable: [],
    nonwritable: []
};
JSPLib.initializeModule('danbooru');
JSPLib.debug.addModuleLogs('danbooru', ['submitRequest', 'getAllItems', 'getPostsCountdown', 'initializePageCounter', 'updatePageCounter']);
