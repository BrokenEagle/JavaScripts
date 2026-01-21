/****DEPENDENCIES****/

/**External dependencies**/
// jQuery
// Danbooru

/**Internal dependencies**/
// JSPLib.utility
// JSPLib.network

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function (debug, utility, network, notice) {

const danbooru = JSPLib.danbooru;

/****GLOBAL VARIABLES****/

danbooru.counter_domname = null;
danbooru.read_throttled_requests = 4;
danbooru.read_throttle_limit = 8;
danbooru.stop_duration = utility.one_second * 5;
danbooru.write_api_limit = 10;

/****FUNCTIONS****/

//Network functions

danbooru.submitRequest = async function (path, url_addons = {}, {default_val = null, long_format = false, key, domain = '', notify = false} = {}) {
    const printer = debug.getFunctionPrint('danbooru.submitRequest');
    const waitCondition = () => (NUM_READ_REQUESTS >= danbooru.max_read_requests);
    if (waitCondition()) {
        printer.debugwarnLevel("Network read requests exceeded!", debug.WARNING);
        await network.waitNetwork(waitCondition);
    }
    danbooru.updateReadRequests(+1);
    key = key || String(utility.getUniqueID());
    printer.debuglogLevel({path, url_addons, default_val, long_format, key, domain, notify}, debug.ALL);
    debug.recordTime(key, 'Network');
    var results;
    if (long_format) {
        url_addons._method = 'get';
        results = network.post(`${domain}/${path}.json`, {data: url_addons});
    } else {
        results = network.getJSON(`${domain}/${path}.json`, {data: url_addons});
    }
    return results.then(
        //Success (return data)
        (data) => data,
        //Failure (return default)
        (resp) => {
            let error = network.processError(resp, "danbooru.submitRequest");
            let error_key = `${domain}/${path}?${utility.renderParams(url_addons)}`;
            network.logError(error_key, error);
            if (notify) {
                network.notifyError(error);
            }
            if (resp.status === 429 && !READS_STOPPED) {
                printer.debugwarnLevel("Stopping read requests.", debug.WARNING);
                READS_STOPPED = true;
                utility.sleep(danbooru.stop_duration).then(() => {
                    printer.debugwarnLevel("Restarting read requests.", debug.WARNING);
                    READS_STOPPED = false;
                });
            }
            return default_val;
        }
    ).always(() => {
        debug.recordTimeEnd(key, 'Network');
        danbooru.updateReadRequests(-1);
    });
};

danbooru.getAllPageItems = async function (type, limit, {url_addons = {}, batches = null, reverse = false, long_format = false, page = null, domain = "", domname = null, notify = false} = {}) {
    const printer = debug.getFunctionPrint('danbooru.getAllPageItems');
    printer.debuglogLevel({type, limit, url_addons, batches, reverse, long_format, page, domain, domname, notify}, debug.ALL);
    let page_modifier = (reverse ? 'a' : 'b');
    let page_addon = (Number.isInteger(page) ? {page: `${page_modifier}${page}`} : {});
    let limit_addon = {limit};
    let batch_num = 1;
    var return_items = [];
    await danbooru.initializePageCounter(type, limit, url_addons, reverse, long_format, page, domain, domname, notify);
    while (true) {
        let request_addons = utility.mergeHashes(url_addons, page_addon, limit_addon);
        let temp_items = await danbooru.submitRequest(type, request_addons, {default_val: [], long_format, domain, notify});
        return_items = utility.concat(return_items, temp_items);
        let lastid = danbooru.getNextPageID(temp_items, reverse);
        danbooru.updatePageCounter(domname, limit, lastid);
        if (temp_items.length < limit || (batches && batch_num >= batches)) {
            return return_items;
        }
        page_addon = {page: `${page_modifier}${lastid}`};
        printer.debuglogLevel("#", batch_num++, "Rechecking", type, "@", lastid, debug.INFO);
    }
};

danbooru.getAllIDItems = async function (type, id_list, limit, {id_addon = null, other_addons = {}, long_format = false, domain = "", domname = null, notify = false} = {}) {
    const printer = debug.getFunctionPrint('danbooru.getAllIDItems');
    if (!utility.validateIDList(id_list)) {
        throw new Error("danbooru.getAllIDItems: Invalid ID list");
    }
    printer.debuglogLevel({type, id_list, limit, id_addon, other_addons, long_format, domain, domname, notify}, debug.ALL);
    id_addon ??= (arr) => ({search: {id: arr.join(',')}});
    let limit_addon = {limit};
    var return_items = [];
    let total_pages = Math.ceil(id_list.length / limit);
    danbooru.setIDCounter(domname, total_pages);
    for (let i = 0; i < id_list.length; i += limit) {
        let sublist = id_list.slice(i, i + limit);
        let request_addons = utility.mergeHashes(id_addon(sublist), other_addons, limit_addon);
        let temp_items = await danbooru.submitRequest(type, request_addons, {default_val: [], long_format, domain, notify});
        return_items = utility.concat(return_items, temp_items);
        danbooru.setIDCounter(domname, --total_pages);
    }
    return return_items;
};

danbooru.getPostsCountdown = async function (query, limit, only, domname) {
    const printer = debug.getFunctionPrint('danbooru.getPostsCountdown');
    printer.debuglogLevel({query, limit, only, domname}, debug.VERBOSE);
    let tag_addon = {tags: query};
    let only_addon = (only ? {only} : {});
    let limit_addon = {limit};
    let page_addon = {};
    var return_items = [];
    let page_num = 1;
    var counter;
    if (domname) {
        let count_resp = await danbooru.submitRequest('counts/posts', tag_addon, {default_val: {counts: {posts: 0}}});
        try {
            counter = Math.ceil(count_resp.counts.posts / limit);
        } catch (e) {
            printer.debugwarnLevel("Malformed count response", count_resp, e, debug.ERROR);
            counter = '<span title="Malformed count response" style="color:red">Error!</span>';
        }
    }
    while (true) {
        if (domname) {
            JSPLib._jQuery(domname).html(counter);
        }
        if (Number.isInteger(counter)) {
            printer.debuglogLevel("Pages left #", counter--, debug.INFO);
        } else {
            printer.debuglogLevel("Pages done #", page_num++, debug.INFO);
        }
        let request_addons = utility.mergeHashes(tag_addon, limit_addon, only_addon, page_addon);
        let request_key = 'posts-' + utility.renderParams(request_addons);
        let temp_items = await danbooru.submitRequest('posts', request_addons, {default_val: [], key: request_key});
        return_items = utility.concat(return_items, temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = danbooru.getNextPageID(temp_items, false);
        page_addon = {page: `b${lastid}`};
    }
};

danbooru.updatePost = async function (post_id, params) {
    if (!utility.isHash(params?.post)) return;
    await danbooru.updateSetup();
    return network.put(`/posts/${post_id}.json`, {data: {...params}})
        .always(danbooru.alwaysCallback())
        .then(
            danbooru.successCallback(post_id, 'danbooru.updatePost', (post_data) => {
                let $post_article = JSPLib._jQuery(`#post_${post_data.id}`);
                utility.setDataAttribute($post_article, 'tags', post_data.tag_string);
                utility.setDataAttribute($post_article, 'rating', post_data.rating);
                utility.setDataAttribute($post_article, 'score', post_data.score);
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
                    utility.setDataAttribute($img, 'title', title);
                }
                let $post_votes = $post_article.find('.post-votes');
                if ($post_votes.length) {
                    _updatePostVotes(params, post_data, $post_votes);
                }
                $post_article.find('.post-preview-image').get(0)._tippy?.destroy();
            }),
            danbooru.errorCallback(post_id, 'danbooru.updatePost', params)
        );
};

//Helper functions

danbooru.updateReadRequests = function(change) {
    NUM_READ_REQUESTS += change;
    if (NUM_READ_REQUESTS >= danbooru.read_throttle_limit) {
        debug.debugwarnLevel("danbooru reads: Throttling connection.", debug.WARNING);
        READS_THROTTLED = true;
    } else if (READS_THROTTLED) {
        debug.debugwarnLevel("danbooru reads: Releasing throttle.", debug.WARNING);
        READS_THROTTLED = false;
    }
    if (danbooru.counter_domname) {
        JSPLib._jQuery(danbooru.counter_domname).html(NUM_READ_REQUESTS);
    }
};

danbooru.getNextPageID = function (array, reverse) {
    let ChooseID = (reverse ? Math.max : Math.min);
    let valid_items = array.filter((val) => ('id' in val));
    return ChooseID(...valid_items.map((val) => val.id));
};

danbooru.showPendingUpdateNotice = function() {
    if (PENDING_UPDATES.finished) return;
    let text = (PENDING_UPDATES.plural ? 'posts' : 'post');
    if (PENDING_UPDATES.count === 0) {
        text = utility.titleizeString(text);
        notice.notice(`${text} updated.`);
        PENDING_UPDATES.reset();
    } else {
        notice.notice(`Updating ${text} (${PENDING_UPDATES.count} pending)...`, true);
    }
};

danbooru.updateSetup = async function () {
    const printer = debug.getFunctionPrint('updateSetup');
    const waitCondition = () => (NUM_WRITE_REQUESTS >= danbooru.max_network_requests);
    PENDING_UPDATES.count += 1;
    danbooru.showPendingUpdateNotice();
    if (waitCondition()) {
        printer.debugwarnLevel("Network write requests exceeded!", debug.WARNING);
        await network.waitNetwork(waitCondition);
    }
    NUM_WRITE_REQUESTS++;
};

danbooru.alwaysCallback = function () {
    return function (pre, status, post) {
        let resp = (status === 'error' ? pre : post);
        PENDING_UPDATES.count -= 1;
        NUM_WRITE_REQUESTS--;
        danbooru.checkAPIRateLimit(resp);
    };
};

danbooru.successCallback = function (post_id, func_name, success) {
    return function (data) {
        debug.debuglogLevel(`${func_name}-success:`, data, debug.INFO);
        if (typeof success === 'function') {
            success(data);
        }
        danbooru.showPendingUpdateNotice();
        danbooru.highlightPost(post_id, false);
        return true;
    };
};

danbooru.errorCallback = function (post_id, func_name, params) {
    return function (resp) {
        let error = network.processError(resp, func_name);
        let error_key = `${func_name}-${post_id}`;
        if (params) {
            error_key += '-' + utility.renderParams(params);
        }
        network.logError(error_key, error);
        network.notifyError(error);
        danbooru.highlightPost(post_id, true);
        if (resp.status === 429 && !WRITES_STOPPED) {
            debug.debugwarnLevel("Stopping read requests.", debug.WARNING);
            WRITES_STOPPED = true;
            utility.sleep(danbooru.stop_duration).then(() => {
                debug.debugwarnLevel("Restarting read requests.", debug.WARNING);
                WRITES_STOPPED = false;
            });
        }
        return false;
    };
};

danbooru.checkAPIRateLimit = function (resp) {
    const printer = debug.getFunctionPrint('danbooru.checkAPIRateLimit');
    var data;
    try {
        data = JSON.parse(resp.getResponseHeader('x-rate-limit'));
    } catch (error) {
        printer.debugerrorLevel("Unable to get response rate limit.", debug.ERROR);
        return;
    }
    if (!utility.isHash(data.limits)) return;
    let current_limit = danbooru.current_limit = Math.min(...Object.values(data.limits));
    let api_depleted = current_limit < danbooru.write_api_limit;
    printer.debuglogLevel(current_limit, api_depleted, debug.DEBUG);
    if (api_depleted !== WRITES_THROTTLED) {
        if (api_depleted) {
            printer.debugwarnLevel("Throttling connection.", debug.WARNING);
        } else {
            printer.debugwarnLevel("Releasing rate limit.", debug.WARNING);
        }
        WRITES_THROTTLED = api_depleted;
    }
};

//Counter functions

danbooru.initializePageCounter = async function (type, limit, url_addons, reverse, long_format, page, domain, domname, notify) {
    const printer = debug.getFunctionPrint('danbooru.initializePageCounter');
    if (domname && Number.isInteger(page)) {
        let latest_id = JSPLib._jQuery(domname).data('latest-id');
        if (!Number.isInteger(latest_id)) {
            let request_addons = utility.mergeHashes(url_addons, {limit: 1}, {only: 'id'});
            if (!reverse) {
                request_addons.page = 'a0';
            }
            let latest_item = await danbooru.submitRequest(type, request_addons, {default_val: [], long_format, domain, notify});
            if (latest_item.length) {
                latest_id = latest_item[0].id;
                let current_counter = Math.abs(Math.ceil((latest_id - page) / limit));
                JSPLib._jQuery(domname).text(current_counter);
                JSPLib._jQuery(domname).data('latest-id', latest_id);
                printer.debuglogLevel(current_counter, latest_id, page, debug.INFO);
            }
        }
    }
};

danbooru.updatePageCounter = function (domname, limit, page) {
    const printer = debug.getFunctionPrint('danbooru.updatePageCounter');
    if (domname) {
        let latest_id = JSPLib._jQuery(domname).data('latest-id');
        if (Number.isInteger(latest_id)) {
            let current_counter = (Number.isInteger(page) ? Math.abs(Math.ceil((latest_id - page) / limit)) : 0);
            JSPLib._jQuery(domname).text(current_counter);
            printer.debuglogLevel(current_counter, latest_id, page, debug.INFO);
        }
    }
};

danbooru.setIDCounter = function (domname, counter) {
    if (domname) {
        JSPLib._jQuery(domname).text(counter);
    }
};

//Tag functions

danbooru.getShortName = function (category) {
    return CATEGORY_MAPPING[category];
};

//Page functions

danbooru.getModel = function() {
    let partial_model = utility.camelCase(document.body.dataset.controller).replace(/i?e?s$/, '');
    let model_keys = Object.keys(document.body.dataset).filter((val) => val.match(new RegExp(partial_model)));
    if (model_keys.length === 0) {
        return null;
    }
    return utility.kebabCase(model_keys[0]).replace(/-[a-z]+$/, '');
};

danbooru.getShowID = function() {
    if (document.body.dataset.action !== "show") {
        return 0;
    }
    let model = danbooru.getModel();
    if (model === null) {
        return 0;
    }
    let show_key = utility.camelCase(model) + 'Id';
    return Number(document.body.dataset[show_key]) || 0;
};

danbooru.isSettingMenu = function () {
    return (document.body.dataset.controller === "users") && (document.body.dataset.action === "edit");
};

//DOM functions

danbooru.initializeHighlights = function () {
    POST_HIGHLIGHT_ENABLED = true;
    utility.setCSSStyle(HIGHLIGHT_CSS, 'danbooru');
};

danbooru.highlightPost = function (post_id, highlight_on) {
    if (!POST_HIGHLIGHT_ENABLED) return;
    if (!(post_id in POST_HIGHLIGHT_DICT)) {
        if (highlight_on) {
            let $post = JSPLib._jQuery('#post_' + post_id);
            let $highlight = POST_HIGHLIGHT_DICT[post_id] = JSPLib._jQuery('<div class="danbooru-post-highlight"></div>');
            $highlight.css({height: $post[0].offsetHeight, width: $post[0].offsetWidth});
            $post.css('position', 'relative');
            $post.append($highlight);
        } else {
            return;
        }
    }
    if (highlight_on) {
        POST_HIGHLIGHT_DICT[post_id].show();
    } else {
        POST_HIGHLIGHT_DICT[post_id].hide();
    }
};

danbooru.initializeAutocomplete = function (selector, autocomplete_type) {
    let $fields = JSPLib._jQuery(selector);
    utility.setDataAttribute($fields, 'autocomplete', autocomplete_type);
    if (['tag-edit', 'tag-query'].includes(autocomplete_type)) {
        $fields.autocomplete({
            select (_event, ui) {
                JSPLib._Danbooru.Autocomplete.insert_completion(this, ui.item.value);
                return false;
            },
            async source(_request, respond) {
                let term = JSPLib._Danbooru.Autocomplete.current_term(this.element);
                let results = await JSPLib._Danbooru.Autocomplete.autocomplete_source(term, 'tag_query');
                respond(results);
            },
        });
    } else {
        let query_type = autocomplete_type.replaceAll(/-/g, '_');
        JSPLib._Danbooru.Autocomplete.initialize_fields($fields, query_type);
    }
};

//Render functions

danbooru.postSearchLink = function (text, params, options = {}) {
    let query = utility.renderParams(params);
    options.href = '/posts?' + query;
    return utility.renderHTMLTag('a', text, options);
};

danbooru.wikiLink = function (text, title, options = {}) {
    options.href = '/wiki_pages/' + encodeURIComponent(title);
    return utility.renderHTMLTag('a', text, options);
};

/****PRIVATE DATA****/

var NUM_READ_REQUESTS = 0;
var READS_THROTTLED = false;
var READS_STOPPED = false;

var NUM_WRITE_REQUESTS = 0;
var WRITES_THROTTLED = false;
var WRITES_STOPPED = false;

var POST_HIGHLIGHT_ENABLED = false;
const POST_HIGHLIGHT_DICT = {};
const HIGHLIGHT_CSS = `
div.danbooru-post-highlight {
    top: 0;
    left: 0;
    position: absolute;
    background: repeating-linear-gradient( 45deg, #FF0000, rgba(0,0,0, 0) 5px,rgba(0,0,0, 0) 50px);
    pointer-events: none;
}`;

const PENDING_UPDATES = {
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

const CATEGORY_MAPPING = {
    artist: 'art',
    character: 'char',
    copyright: 'copy',
    general: 'gen',
    meta: 'meta',
};

/********
 *  The rate limit for reads is a hard 10 per second. Reducing the max to 6 was necessary to eliminate 429 responses.
 *  The rate limit for writes is based upon the API limit instead, so it can burst up to 25 at once and still be fine.
 */
var MAX_READ_REQUESTS = 10;
var MAX_WRITE_REQUESTS = 25;

/****PRIVATE FUNCTIONS****/

function _updatePostVotes (params, post_data, $post_votes) {
    let fav_matches = utility.findAll(params.post.tag_string ?? "", /(?<=^| )-?fav:me(?= |$)/g);
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
        danbooru.submitRequest('post_votes', {search: {post_id: post_data.id, user_id: JSPLib._Danbooru.CurrentUser.data('id')}, limit: 1})
            .then((vote_data) => {
                $post_votes.find('.active-link').toggleClass('active-link inactive-link');
                if (vote_data.length) {
                    let vote_selector = (vote_data[0].score > 0 ? '.post-upvote-link' : '.post-downvote-link');
                    let $vote = $post_votes.find(vote_selector);
                    $vote.toggleClass('active-link inactive-link');
                    $vote.addClass('post-unvote-link');
                    utility.setDataAttribute($vote, 'method', 'delete');
                    $vote.attr('href', `/post_votes/${vote_data[0].id}`);
                }
            });
    }
}

/****INITIALIZATION****/

Object.defineProperties(danbooru, {
    max_read_requests: {
        get () {return (READS_THROTTLED ? danbooru.read_throttled_requests : MAX_READ_REQUESTS);},
        set (val) {MAX_READ_REQUESTS = val;}
    },
    max_write_requests: {
        get () {return (WRITES_THROTTLED ? 1 : MAX_WRITE_REQUESTS);},
        set (val) {MAX_WRITE_REQUESTS = val;}
    },
});

JSPLib.initializeModule('danbooru');

})(JSPLib.debug, JSPLib.utility, JSPLib.network, JSPLib.notice);
