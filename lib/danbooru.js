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

JSPLib.danbooru.counter_domname = null;

JSPLib.danbooru.num_read_requests = 0;
JSPLib.danbooru.reads_throttled = false;
JSPLib.danbooru.reads_stopped = false;
JSPLib.danbooru.read_throttled_requests = 4;
JSPLib.danbooru.read_throttle_limit = 8;
JSPLib.danbooru.stop_duration = JSPLib.utility.one_second * 5;

JSPLib.danbooru.num_write_requests = 0;
JSPLib.danbooru.writes_throttled = false;
JSPLib.danbooru.api_limit = 10;

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
JSPLib.danbooru.pending_updates = {
    get count () { return this._count; },
    set count (val) {
        this._count = val;
        this.plural ||= this._count > 1;
        this.finished &&= false;
    },
    reset() {
        this.plural = false;
        this.finished = true;
    },
    plural: false,
    finished: false,
    _count: 0,
};

/****FUNCTIONS****/

//Network functions

JSPLib.danbooru.submitRequest = async function (path, url_addons = {}, {default_val = null, long_format = false, key, domain = '', notify = false} = {}) {
    const printer = JSPLib.debug.getFunctionPrint('danbooru.submitRequest');
    const waitCondition = () => (this.num_read_requests >= this.max_read_requests);
    if (waitCondition()) {
        printer.debugwarnLevel("Network read requests exceeded!", JSPLib.debug.WARNING);
        await JSPLib.network.waitNetwork(waitCondition);
    }
    this.updateReadRequests(+1);
    key = key || String(JSPLib.utility.getUniqueID());
    printer.debuglogLevel({path, url_addons, default_val, long_format, key, domain, notify}, JSPLib.debug.ALL);
    JSPLib.debug.recordTime(key, 'Network');
    var results;
    if (long_format) {
        url_addons._method = 'get';
        results = JSPLib.network.post(`${domain}/${path}.json`, {data: url_addons});
    } else {
        results = JSPLib.network.getJSON(`${domain}/${path}.json`, {data: url_addons});
    }
    return results.then(
        //Success (return data)
        (data) => data,
        //Failure (return default)
        (resp) => {
            let error = JSPLib.network.processError(resp, "danbooru.submitRequest");
            let error_key = `${domain}/${path}?${JSPLib.utility.renderParams(url_addons)}`;
            JSPLib.network.logError(error_key, error);
            if (notify) {
                JSPLib.network.notifyError(error);
            }
            if (resp.status === 429 && !this.reads_stopped) {
                printer.debugwarnLevel("Stopping read requests.", JSPLib.debug.WARNING);
                this.reads_stopped = true;
                JSPLib.utility.sleep(this.stop_duration).then(() => {
                    printer.debugwarnLevel("Restarting read requests.", JSPLib.debug.WARNING);
                    this.reads_stopped = false;
                });
            }
            return default_val;
        }
    ).always(() => {
        JSPLib.debug.recordTimeEnd(key, 'Network');
        this.updateReadRequests(-1);
    });
};

JSPLib.danbooru.getAllPageItems = async function (type, limit, {url_addons = {}, batches = null, reverse = false, long_format = false, page = null, domain = "", domname = null, notify = false} = {}) {
    const printer = JSPLib.debug.getFunctionPrint('danbooru.getAllPageItems');
    printer.debuglogLevel({type, limit, url_addons, batches, reverse, long_format, page, domain, domname, notify}, JSPLib.debug.ALL);
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
        printer.debuglogLevel("#", batch_num++, "Rechecking", type, "@", lastid, JSPLib.debug.INFO);
    }
};

JSPLib.danbooru.getAllIDItems = async function (type, id_list, limit, {id_addon = null, other_addons = {}, long_format = false, domain = "", domname = null, notify = false} = {}) {
    const printer = JSPLib.debug.getFunctionPrint('danbooru.getAllIDItems');
    if (!JSPLib.utility.validateIDList(id_list)) {
        throw new Error("danbooru.getAllIDItems: Invalid ID list");
    }
    printer.debuglogLevel({type, id_list, limit, id_addon, other_addons, long_format, domain, domname, notify}, JSPLib.debug.ALL);
    id_addon ??= (arr) => ({search: {id: arr.join(',')}});
    let limit_addon = {limit};
    var return_items = [];
    let total_pages = Math.ceil(id_list.length / limit);
    this.setIDCounter(domname, total_pages);
    for (let i = 0; i < id_list.length; i += limit) {
        let sublist = id_list.slice(i, i + limit);
        let request_addons = JSPLib.utility.mergeHashes(id_addon(sublist), other_addons, limit_addon);
        let temp_items = await this.submitRequest(type, request_addons, {default_val: [], long_format, domain, notify});
        return_items = JSPLib.utility.concat(return_items, temp_items);
        this.setIDCounter(domname, --total_pages);
    }
    return return_items;
};

JSPLib.danbooru.getPostsCountdown = async function (query, limit, only, domname) {
    const printer = JSPLib.debug.getFunctionPrint('danbooru.getPostsCountdown');
    printer.debuglogLevel({query, limit, only, domname}, JSPLib.debug.VERBOSE);
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
            printer.debugwarnLevel("Malformed count response", count_resp, e, JSPLib.debug.ERROR);
            counter = '<span title="Malformed count response" style="color:red">Error!</span>';
        }
    }
    while (true) {
        if (domname) {
            JSPLib._jQuery(domname).html(counter);
        }
        if (Number.isInteger(counter)) {
            printer.debuglogLevel("Pages left #", counter--, JSPLib.debug.INFO);
        } else {
            printer.debuglogLevel("Pages done #", page_num++, JSPLib.debug.INFO);
        }
        let request_addons = JSPLib.utility.mergeHashes(tag_addon, limit_addon, only_addon, page_addon);
        let request_key = 'posts-' + JSPLib.utility.renderParams(request_addons);
        let temp_items = await this.submitRequest('posts', request_addons, {default_val: [], key: request_key});
        return_items = JSPLib.utility.concat(return_items, temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = this.getNextPageID(temp_items, false);
        page_addon = {page: `b${lastid}`};
    }
};

JSPLib.danbooru.updatePost = async function (post_id, params) {
    if (!JSPLib.utility.isHash(params?.post)) return;
    await this.updateSetup();
    return JSPLib.network.put(`/posts/${post_id}.json`, {data: {...params}})
        .always(this.alwaysCallback())
        .then(
            this.successCallback(post_id, 'danbooru.updatePost', (post_data) => {
                let $post_article = JSPLib._jQuery(`#post_${post_data.id}`);
                JSPLib.utility.setDataAttribute($post_article, 'tags', post_data.tag_string);
                JSPLib.utility.setDataAttribute($post_article, 'rating', post_data.rating);
                JSPLib.utility.setDataAttribute($post_article, 'score', post_data.score);
                if (post_data.has_children) {
                    $post_article.addClass('post-status-has-children');
                } else {
                    $post_article.removeClass('post-status-has-children');
                }
                if (post_data.parent_id !== null) {
                    $post_article.addClass('post-status-has-parent');
                } else {
                    $post_article.removeClass('post-status-has-parent');
                }
                let $img = $post_article.find('img');
                let title = `${post_data.tag_string} rating:${post_data.rating} score:${post_data.score}`;
                if ($img.attr('title')) {
                    $img.attr('title', title);
                } else if ($img.data('title')) {
                    JSPLib.utility.setDataAttribute($img, 'title', title);
                }
                let $post_votes = $post_article.find('.post-votes');
                if ($post_votes.length) {
                    this._updatePostVotes(params, post_data, $post_votes);
                }
                $post_article.find('.post-preview-image').get(0)._tippy?.destroy();
            }),
            this.errorCallback(post_id, 'danbooru.updatePost', params)
        );
};

//Helper functions

JSPLib.danbooru.updateReadRequests = function(change) {
    this.num_read_requests += change;
    if (this.num_read_requests >= this.read_throttle_limit) {
        JSPLib.debug.debugwarnLevel("danbooru reads: Throttling connection.", JSPLib.debug.WARNING);
        this.reads_throttled = true;
    } else if (this.reads_throttled) {
        JSPLib.debug.debugwarnLevel("danbooru reads: Releasing throttle.", JSPLib.debug.WARNING);
        this.reads_throttled = false;
    }
    if (this.counter_domname) {
        JSPLib._jQuery(this.counter_domname).html(this.num_read_requests);
    }
};

JSPLib.danbooru.getNextPageID = function (array, reverse) {
    let ChooseID = (reverse ? Math.max : Math.min);
    let valid_items = array.filter((val) => ('id' in val));
    return ChooseID(...valid_items.map((val) => val.id));
};

JSPLib.danbooru.showPendingUpdateNotice = function() {
    if (this.pending_updates.finished) return;
    let text = (this.pending_updates.plural ? 'posts' : 'post');
    if (this.pending_updates.count === 0) {
        text = JSPLib.utility.titleizeString(text);
        JSPLib.notice.notice(`${text} updated.`);
        this.pending_updates.reset();
    } else {
        JSPLib.notice.notice(`Updating ${text} (${this.pending_updates.count} pending)...`, true);
    }
};

JSPLib.danbooru.updateSetup = async function () {
    const printer = JSPLib.debug.getFunctionPrint('updateSetup');
    const waitCondition = () => (this.num_write_requests >= this.max_network_requests);
    this.pending_updates.count += 1;
    this.showPendingUpdateNotice();
    if (waitCondition()) {
        printer.debugwarnLevel("Network write requests exceeded!", JSPLib.debug.WARNING);
        await JSPLib.network.waitNetwork(waitCondition);
    }
    this.num_write_requests++;
};

JSPLib.danbooru.alwaysCallback = function () {
    const context = this;
    return function (pre, status, post) {
        let resp = (status === 'error' ? pre : post);
        context.pending_updates.count -= 1;
        this.num_write_requests--;
        context.checkAPIRateLimit(resp);
    };
};

JSPLib.danbooru.successCallback = function (post_id, func_name, success) {
    const context = this;
    return function (data) {
        JSPLib.debug.debuglogLevel(`${func_name}-success:`, data, JSPLib.debug.INFO);
        if (typeof success === 'function') {
            success(data);
        }
        context.showPendingUpdateNotice();
        context.highlightPost(post_id, false);
        return true;
    };
};

JSPLib.danbooru.errorCallback = function (post_id, func_name, params) {
    const context = this;
    return function (resp) {
        let error = JSPLib.network.processError(resp, func_name);
        let error_key = `${func_name}-${post_id}`;
        if (params) {
            error_key += '-' + JSPLib.utility.renderParams(params);
        }
        JSPLib.network.logError(error_key, error);
        JSPLib.network.notifyError(error);
        context.highlightPost(post_id, true);
        return false;
    };
};

JSPLib.danbooru.checkAPIRateLimit = function (resp) {
    const printer = JSPLib.debug.getFunctionPrint('danbooru.checkAPIRateLimit');
    var data;
    try {
        data = JSON.parse(resp.getResponseHeader('x-rate-limit'));
    } catch (error) {
        printer.debugerrorLevel("Unable to get response rate limit.", JSPLib.debug.ERROR);
        return;
    }
    if (!JSPLib.utility.isHash(data.limits)) return;
    let current_limit = this.current_limit = Math.min(...Object.values(data.limits));
    let writes_throttled = current_limit < this.api_limit;
    printer.debuglogLevel(current_limit, writes_throttled, JSPLib.debug.DEBUG);
    if (writes_throttled !== this.writes_throttled) {
        if (writes_throttled) {
            printer.debugwarnLevel("Throttling connection.", JSPLib.debug.WARNING);
            this.writes_throttled = true;
        } else {
            printer.debugwarnLevel("Releasing rate limit.", JSPLib.debug.WARNING);
            this.writes_throttled = false;
        }
        this.writes_throttled = writes_throttled;
    }
};

//Counter functions

JSPLib.danbooru.initializePageCounter = async function (type, limit, url_addons, reverse, long_format, page, domain, domname, notify) {
    const printer = JSPLib.debug.getFunctionPrint('danbooru.initializePageCounter');
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
                printer.debuglogLevel(current_counter, latest_id, page, JSPLib.debug.INFO);
            }
        }
    }
};

JSPLib.danbooru.updatePageCounter = function (domname, limit, page) {
    const printer = JSPLib.debug.getFunctionPrint('danbooru.updatePageCounter');
    if (domname) {
        let latest_id = JSPLib._jQuery(domname).data('latest-id');
        if (Number.isInteger(latest_id)) {
            let current_counter = (Number.isInteger(page) ? Math.abs(Math.ceil((latest_id - page) / limit)) : 0);
            JSPLib._jQuery(domname).text(current_counter);
            printer.debuglogLevel(current_counter, latest_id, page, JSPLib.debug.INFO);
        }
    }
};

JSPLib.danbooru.setIDCounter = function (domname, counter) {
    if (domname) {
        JSPLib._jQuery(domname).text(counter);
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

JSPLib.danbooru.initializeAutocomplete = function (selector, autocomplete_type) {
    let $fields = JSPLib._jQuery(selector);
    JSPLib.utility.setDataAttribute($fields, 'autocomplete', autocomplete_type);
    if (['tag-edit', 'tag-query'].includes(autocomplete_type)) {
        $fields.autocomplete({
            select (_event, ui) {
                Danbooru.Autocomplete.insert_completion(this, ui.item.value);
                return false;
            },
            async source(_request, respond) {
                let term = Danbooru.Autocomplete.current_term(this.element);
                let results = await Danbooru.Autocomplete.autocomplete_source(term, 'tag_query');
                respond(results);
            },
        });
    } else {
        let query_type = autocomplete_type.replaceAll(/-/g, '_');
        Danbooru.Autocomplete.initialize_fields($fields, query_type);
    }
};

//Render functions

JSPLib.danbooru.postSearchLink = function (text, params, options = {}) {
    let query = JSPLib.utility.renderParams(params);
    options.href = '/posts?' + query;
    return JSPLib.utility.renderHTMLTag('a', text, options);
};

JSPLib.danbooru.wikiLink = function (text, title, options = {}) {
    options.href = '/wiki_pages/' + encodeURIComponent(title);
    return JSPLib.utility.renderHTMLTag('a', text, options);
};

/****PRIVATE DATA****/

JSPLib.danbooru._throttled = false;
/********
 *  The rate limit for reads is a hard 10 per second. Reducing the max to 6 was necessary to eliminate 429 responses.
 *  The rate limit for writes is based upon the API limit instead, so it can burst up to 25 at once and still be fine.
 */
JSPLib.danbooru._max_read_requests = 10;
JSPLib.danbooru._max_write_requests = 25;

/****PRIVATE FUNCTIONS****/

JSPLib.danbooru._updatePostVotes = function (params, post_data, $post_votes) {
    let fav_matches = JSPLib.utility.findAll(params.post.tag_string ?? "", /(?<=^| )-?fav:me(?= |$)/g);
    if (fav_matches.length) {
        let last_match = fav_matches.at(-1);
        if (last_match === 'fav:me' && $post_votes.find('.post-upvote-link.active-link').length === 0) {
            $post_votes.find('.post-score a').text(post_data.score + 1);
        } else if (last_match === '-fav:me' && $post_votes.find('.post-upvote-link.inactive-link').length === 0) {
            $post_votes.find('.post-score a').text(post_data.score - 1);
        } else {
            $post_votes.find('.post-score a').text(post_data.score);
        }
    } else {
        $post_votes.find('.post-score a').text(post_data.score);
    }
    if (/(?:^| )(?:upvote:self|downvote:self|-?fav:me)(?: |$)/.test(params.post.tag_string)) {
        this.submitRequest('post_votes', {search: {post_id: post_data.id, user_id: JSPLib._Danbooru.CurrentUser.data('id')}, limit: 1})
            .then((vote_data) => {
                $post_votes.find('.active-link').toggleClass('active-link inactive-link');
                if (vote_data.length) {
                    let vote_selector = (vote_data[0].score > 0 ? '.post-upvote-link' : '.post-downvote-link');
                    let $vote = $post_votes.find(vote_selector);
                    $vote.toggleClass('active-link inactive-link');
                    $vote.addClass('post-unvote-link');
                    JSPLib.utility.setDataAttribute($vote, 'method', 'delete');
                    $vote.attr('href', `/post_votes/${vote_data[0].id}`);
                }
            });
    }
};

/****INITIALIZATION****/

Object.defineProperties(JSPLib.danbooru, {
    max_read_requests: {
        get () {return (this.reads_throttled ? this.read_throttled_requests : this._max_read_requests);},
        set (val) {this._max_read_requests = val;}
    },
    max_write_requests: {
        get () {return (this.writes_throttled ? 1 : this._max_write_requests);},
        set (val) {this._max_write_requests = val;}
    },
});

JSPLib.danbooru._configuration = {
    nonenumerable: [],
    nonwritable: []
};
JSPLib.initializeModule('danbooru');
