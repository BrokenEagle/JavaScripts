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
JSPLib.danbooru.rate_limited = false;
JSPLib.danbooru.min_rate_limit = 10;
JSPLib.danbooru.pending_update_count = 0;
JSPLib.danbooru.post_highlight_dict = {};
JSPLib.danbooru.highlight_post_enabled = true;
JSPLib.danbooru.highlight_css = `
div.danbooru-post-highlight {
    top: 0;
    left: 0;
    position: absolute;
    background: repeating-linear-gradient( 45deg, #FF0000, rgba(0,0,0, 0) 5px,rgba(0,0,0, 0) 50px);
    pointer-events: none;
}`;

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
        let request_addons = JSPLib.utility.mergeHashes(url_addons, page_addon, limit_addon);
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
        let request_addons = JSPLib.utility.mergeHashes(tag_addon, limit_addon, only_addon, page_addon);
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

JSPLib.danbooru.updatePost = async function (post_id, mode, params) {
    this.pending_update_count += 1;
    this.showPendingUpdateNotice();
    if (this.num_network_requests >= this.max_network_requests) {
        await JSPLib.network.rateLimit('danbooru');
    }
    let url_params = new URLSearchParams(JSPLib._window.location.search);
    let show_votes = url_params.get("show_votes");
    let size = url_params.get("size");
    this.num_network_requests += 1;
    return JSPLib.network.put(`/posts/${post_id}.js`, {data: {mode, show_votes, size, ...params}})
        .always((_data, _message, resp) => {
            this.num_network_requests -= 1;
            this.pending_update_count -= 1;
            this.checkAPIRateLimit(resp);
        })
        .then(
            //Success
            () => {
                this.showPendingUpdateNotice();
                this.highlightPost(post_id, false);
            },
            //Failure
            (error) => {
                error = JSPLib.network.processError(error, "danbooru.updatePost");
                let error_key = `updatePost-${post_id}-${mode}-${JSPLib._jQuery.param(params)}`;
                JSPLib.network.logError(error_key, error);
                JSPLib.network.notifyError(error);
                this.highlightPost(post_id, true);
            }
        );
};

//Helper functions

JSPLib.danbooru.getNextPageID = function (array, reverse) {
    let ChooseID = (reverse ? Math.max : Math.min);
    let valid_items = array.filter((val) => ('id' in val));
    return ChooseID(...valid_items.map((val) => val.id));
};

JSPLib.danbooru.showPendingUpdateNotice = function() {
    if (this.pending_update_count === 0) {
        JSPLib.notice.notice("Posts updated");
    } else {
        JSPLib.notice.notice(`Updating posts (${this.pending_update_count} pending)...`, true);
    }
};

JSPLib.danbooru.checkAPIRateLimit = function (self, resp) {
    var data;
    try {
        data = JSON.parse(resp.getResponseHeader('x-rate-limit'));
    } catch (error) {
        self.debug('errorLevel', "Unable to get response rate limit.", JSPLib.debug.ERROR);
        return;
    }
    if (!JSPLib.validate.isHash(data.limits)) return;
    let current_limit = this.current_limit = Math.min(...Object.values(data.limits));
    let rate_limited = current_limit < this.min_rate_limit;
    self.debug('logLevel', current_limit, rate_limited, JSPLib.debug.DEBUG);
    // Temporary (maybe)... will use getter/setter at the top of the script for the library release
    if (rate_limited !== this.rate_limited) {
        if (rate_limited) {
            self.debug('warnLevel', "Throttling connection.", JSPLib.debug.WARNING);
            this._max_network_requests = this.max_network_requests;
            this.max_network_requests = 1;
            this._rate_limit_wait = this.rate_limit_wait;
            this.rate_limit_wait = JSPLib.utility.one_second * 2;
        } else {
            self.debug('warnLevel', "Releasing rate limit.", JSPLib.debug.WARNING);
            this.max_network_requests = this._max_network_requests;
            this.rate_limit_wait = this._rate_limit_wait;
        }
        this.rate_limited = rate_limited;
    }
};

//Counter functions

JSPLib.danbooru.initializePageCounter = async function (self, type, limit, url_addons, reverse, long_format, page, domain, domname, notify) {
    if (domname && Number.isInteger(page)) {
        let latest_id = JSPLib._jQuery(domname).data('latest-id');
        if (!Number.isInteger(latest_id)) {
            let request_addons = JSPLib.utility.mergeHashes(url_addons, {limit: 1}, {only: 'id'});
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

//DOM functions

JSPLib.danbooru.highlightPost = function (post_id, highlight_on) {
    if (!this.highlight_post_enabled) return;
    if (!(post_id in this.post_highlight_dict)) {
        if (highlight_on) {
            let $post = JSPLib._jQuery('#post_' + post_id);
            let $highlight = this.post_highlight_dict[post_id] = JSPLib._jQuery('<div class="danbooru-post-highlight"></div>');
            $highlight.css({height: $post[0].offsetHeight, width: $post[0].offsetWidth});
            $post.css('position', 'relative');
            $post.append($highlight);
        } else {
            return;
        }
    }
    if (highlight_on) {
        this.post_highlight_dict[post_id].show();
    } else {
        this.post_highlight_dict[post_id].hide();
    }
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

JSPLib.danbooru._max_network_requests = 25;

/****INITIALIZATION****/

Object.defineProperty(JSPLib.danbooru, 'max_network_requests', {get: () => (this.rate_limited ? 1 : this._max_network_requests), set: (val) => {this._max_network_requests = val;}});

JSPLib.danbooru._configuration = {
    nonenumerable: [],
    nonwritable: []
};
JSPLib.initializeModule('danbooru');
JSPLib.debug.addModuleLogs('danbooru', ['submitRequest', 'getAllItems', 'getPostsCountdown', 'initializePageCounter', 'updatePageCounter', 'checkAPIRateLimit']);
