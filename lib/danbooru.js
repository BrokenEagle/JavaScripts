/****DEPENDENCIES****/

/**External dependencies**/
// jQuery
// Danbooru

/**Internal dependencies**/
// JSPLib.Debug (optional)
// JSPLib.Notice (optional)
// JSPLib.Utility
// JSPLib.Network

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function ({jQueryProxy, DanbooruProxy, Debug, Utility, Network, Notice}) {

const Danbooru = JSPLib.Danbooru;

/****GLOBAL VARIABLES****/

Danbooru.counter_domname = null;
Danbooru.read_throttled_requests = 4;
Danbooru.read_throttle_limit = 8;
Danbooru.stop_duration = Utility.one_second * 5;
Danbooru.write_api_limit = 10;

Danbooru.categories = Utility.deepFreeze({
    name: {
        general: 0,
        artist: 1,
        copyright: 3,
        character: 4,
        meta: 5
    },
    value: {
        0: 'general',
        1: 'artist',
        3: 'copyright',
        4: 'character',
        5: 'meta',
    },
    short: {
        general: 'gen',
        artist: 'art',
        copyright: 'copy',
        character: 'char',
        meta: 'meta',
    },
    get names() {
        return Object.keys(this.name);
    },
    get values() {
        return Object.values(this.name);
    },
    get shorts() {
        return Object.values(this.short);
    },
});

/****FUNCTIONS****/

//Network functions

Danbooru.submitRequest = async function (path, url_addons = {}, {default_val = null, long_format = false, key, domain = '', notify = false} = {}) {
    const printer = Debug.getFunctionPrint('Danbooru.submitRequest');
    const waitCondition = () => (NUM_READ_REQUESTS >= Danbooru.max_read_requests);
    if (waitCondition()) {
        printer.warnLevel("Network read requests exceeded!", Debug.WARNING);
        await Network.waitNetwork(waitCondition);
    }
    Danbooru.updateReadRequests(+1);
    key = key || String(Utility.getUniqueID());
    printer.logLevel({path, url_addons, default_val, long_format, key, domain, notify}, Debug.ALL);
    Debug.recordTime(key, 'Network');
    var results;
    if (long_format) {
        url_addons._method = 'get';
        results = Network.post(`${domain}/${path}.json`, {data: url_addons});
    } else {
        results = Network.getJSON(`${domain}/${path}.json`, {data: url_addons});
    }
    return results.then(
        //Success (return data)
        (data) => data,
        //Failure (return default)
        (resp) => {
            let error = Network.processError(resp, "Danbooru.submitRequest");
            let error_key = `${domain}/${path}?${Utility.renderParams(url_addons)}`;
            Network.logError(error_key, error);
            if (notify) {
                Network.notifyError(error);
            }
            if (resp.status === 429 && !READS_STOPPED) {
                printer.warnLevel("Stopping read requests.", Debug.WARNING);
                READS_STOPPED = true;
                Utility.sleep(Danbooru.stop_duration).then(() => {
                    printer.warnLevel("Restarting read requests.", Debug.WARNING);
                    READS_STOPPED = false;
                });
            }
            return default_val;
        }
    ).always(() => {
        Debug.recordTimeEnd(key, 'Network');
        Danbooru.updateReadRequests(-1);
    });
};

Danbooru.getAllPageItems = async function (type, limit, {url_addons = {}, batches = null, reverse = false, long_format = false, page = null, domain = "", domname = null, notify = false} = {}) {
    const printer = Debug.getFunctionPrint('Danbooru.getAllPageItems');
    printer.logLevel({type, limit, url_addons, batches, reverse, long_format, page, domain, domname, notify}, Debug.ALL);
    let page_modifier = (reverse ? 'a' : 'b');
    let page_addon = (Number.isInteger(page) ? {page: `${page_modifier}${page}`} : {});
    let limit_addon = {limit};
    let batch_num = 1;
    var return_items = [];
    await Danbooru.initializePageCounter(type, limit, url_addons, reverse, long_format, page, domain, domname, notify);
    while (true) {
        let request_addons = Utility.mergeHashes(url_addons, page_addon, limit_addon);
        let temp_items = await Danbooru.submitRequest(type, request_addons, {default_val: [], long_format, domain, notify});
        return_items = Utility.concat(return_items, temp_items);
        let lastid = Danbooru.getNextPageID(temp_items, reverse);
        Danbooru.updatePageCounter(domname, limit, lastid);
        if (temp_items.length < limit || (batches && batch_num >= batches)) {
            return return_items;
        }
        page_addon = {page: `${page_modifier}${lastid}`};
        printer.logLevel("#", batch_num++, "Rechecking", type, "@", lastid, Debug.INFO);
    }
};

Danbooru.getAllIDItems = async function (type, id_list, limit, {id_addon = null, other_addons = {}, long_format = false, domain = "", domname = null, notify = false} = {}) {
    const printer = Debug.getFunctionPrint('Danbooru.getAllIDItems');
    if (!Utility.validateIDList(id_list)) {
        throw new Error("Danbooru.getAllIDItems: Invalid ID list");
    }
    printer.logLevel({type, id_list, limit, id_addon, other_addons, long_format, domain, domname, notify}, Debug.ALL);
    id_addon ??= (arr) => ({search: {id: arr.join(',')}});
    let limit_addon = {limit};
    var return_items = [];
    let total_pages = Math.ceil(id_list.length / limit);
    Danbooru.setIDCounter(domname, total_pages);
    for (let i = 0; i < id_list.length; i += limit) {
        let sublist = id_list.slice(i, i + limit);
        let request_addons = Utility.mergeHashes(id_addon(sublist), other_addons, limit_addon);
        let temp_items = await Danbooru.submitRequest(type, request_addons, {default_val: [], long_format, domain, notify});
        return_items = Utility.concat(return_items, temp_items);
        Danbooru.setIDCounter(domname, --total_pages);
    }
    return return_items;
};

Danbooru.getPostsCountdown = async function (query, limit, only, domname) {
    const printer = Debug.getFunctionPrint('Danbooru.getPostsCountdown');
    printer.logLevel({query, limit, only, domname}, Debug.VERBOSE);
    let tag_addon = {tags: query};
    let only_addon = (only ? {only} : {});
    let limit_addon = {limit};
    let page_addon = {};
    var return_items = [];
    let page_num = 1;
    var counter;
    if (domname) {
        let count_resp = await Danbooru.submitRequest('counts/posts', tag_addon, {default_val: {counts: {posts: 0}}});
        try {
            counter = Math.ceil(count_resp.counts.posts / limit);
        } catch (e) {
            printer.warnLevel("Malformed count response", count_resp, e, Debug.ERROR);
            counter = '<span title="Malformed count response" style="color:red">Error!</span>';
        }
    }
    while (true) {
        if (domname) {
            jQueryProxy(domname).html(counter);
        }
        if (Number.isInteger(counter)) {
            printer.logLevel("Pages left #", counter--, Debug.INFO);
        } else {
            printer.logLevel("Pages done #", page_num++, Debug.INFO);
        }
        let request_addons = Utility.mergeHashes(tag_addon, limit_addon, only_addon, page_addon);
        let request_key = 'posts-' + Utility.renderParams(request_addons);
        let temp_items = await Danbooru.submitRequest('posts', request_addons, {default_val: [], key: request_key});
        return_items = Utility.concat(return_items, temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = Danbooru.getNextPageID(temp_items, false);
        page_addon = {page: `b${lastid}`};
    }
};

Danbooru.updatePost = async function (post_id, params) {
    if (!Utility.isHash(params?.post)) return;
    await Danbooru.updateSetup();
    return Network.put(`/posts/${post_id}.json`, {data: {...params}})
        .always(Danbooru.alwaysCallback())
        .then(
            Danbooru.successCallback(post_id, 'Danbooru.updatePost', (post_data) => {
                let $post_article = jQueryProxy(`#post_${post_data.id}`);
                Utility.setDataAttribute($post_article, 'tags', post_data.tag_string);
                Utility.setDataAttribute($post_article, 'rating', post_data.rating);
                Utility.setDataAttribute($post_article, 'score', post_data.score);
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
                    Utility.setDataAttribute($img, 'title', title);
                }
                let $post_votes = $post_article.find('.post-votes');
                if ($post_votes.length) {
                    _updatePostVotes(params, post_data, $post_votes);
                }
                $post_article.find('.post-preview-image').get(0)._tippy?.destroy();
            }),
            Danbooru.errorCallback(post_id, 'Danbooru.updatePost', params)
        );
};

//Helper functions

Danbooru.updateReadRequests = function(change) {
    NUM_READ_REQUESTS += change;
    if (NUM_READ_REQUESTS >= Danbooru.read_throttle_limit) {
        Debug.warnLevel("danbooru reads: Throttling connection.", Debug.WARNING);
        READS_THROTTLED = true;
    } else if (READS_THROTTLED) {
        Debug.warnLevel("danbooru reads: Releasing throttle.", Debug.WARNING);
        READS_THROTTLED = false;
    }
    if (Danbooru.counter_domname) {
        jQueryProxy(Danbooru.counter_domname).html(NUM_READ_REQUESTS);
    }
};

Danbooru.getNextPageID = function (array, reverse) {
    let ChooseID = (reverse ? Math.max : Math.min);
    let valid_items = array.filter((val) => ('id' in val));
    return ChooseID(...valid_items.map((val) => val.id));
};

Danbooru.showPendingUpdateNotice = function() {
    if (PENDING_UPDATES.finished) return;
    let text = (PENDING_UPDATES.plural ? 'posts' : 'post');
    if (PENDING_UPDATES.count === 0) {
        text = Utility.titleizeString(text);
        Notice.notice(`${text} updated.`);
        PENDING_UPDATES.reset();
    } else {
        Notice.notice(`Updating ${text} (${PENDING_UPDATES.count} pending)...`, true);
    }
};

Danbooru.updateSetup = async function () {
    const printer = Debug.getFunctionPrint('updateSetup');
    const waitCondition = () => (NUM_WRITE_REQUESTS >= Danbooru.max_network_requests);
    PENDING_UPDATES.count += 1;
    Danbooru.showPendingUpdateNotice();
    if (waitCondition()) {
        printer.warnLevel("Network write requests exceeded!", Debug.WARNING);
        await Network.waitNetwork(waitCondition);
    }
    NUM_WRITE_REQUESTS++;
};

Danbooru.alwaysCallback = function () {
    return function (pre, status, post) {
        let resp = (status === 'error' ? pre : post);
        PENDING_UPDATES.count -= 1;
        NUM_WRITE_REQUESTS--;
        Danbooru.checkAPIRateLimit(resp);
    };
};

Danbooru.successCallback = function (post_id, func_name, success) {
    return function (data) {
        Debug.logLevel(`${func_name}-success:`, data, Debug.INFO);
        if (typeof success === 'function') {
            success(data);
        }
        Danbooru.showPendingUpdateNotice();
        Danbooru.highlightPost(post_id, false);
        return true;
    };
};

Danbooru.errorCallback = function (post_id, func_name, params) {
    return function (resp) {
        let error = Network.processError(resp, func_name);
        let error_key = `${func_name}-${post_id}`;
        if (params) {
            error_key += '-' + Utility.renderParams(params);
        }
        Network.logError(error_key, error);
        Network.notifyError(error);
        Danbooru.highlightPost(post_id, true);
        if (resp.status === 429 && !WRITES_STOPPED) {
            Debug.warnLevel("Stopping read requests.", Debug.WARNING);
            WRITES_STOPPED = true;
            Utility.sleep(Danbooru.stop_duration).then(() => {
                Debug.warnLevel("Restarting read requests.", Debug.WARNING);
                WRITES_STOPPED = false;
            });
        }
        return false;
    };
};

Danbooru.checkAPIRateLimit = function (resp) {
    const printer = Debug.getFunctionPrint('Danbooru.checkAPIRateLimit');
    var data;
    try {
        data = JSON.parse(resp.getResponseHeader('x-rate-limit'));
    } catch (error) {
        printer.errorLevel("Unable to get response rate limit.", Debug.ERROR);
        return;
    }
    if (!Utility.isHash(data.limits)) return;
    let current_limit = Danbooru.current_limit = Math.min(...Object.values(data.limits));
    let api_depleted = current_limit < Danbooru.write_api_limit;
    printer.logLevel(current_limit, api_depleted, Debug.DEBUG);
    if (api_depleted !== WRITES_THROTTLED) {
        if (api_depleted) {
            printer.warnLevel("Throttling connection.", Debug.WARNING);
        } else {
            printer.warnLevel("Releasing rate limit.", Debug.WARNING);
        }
        WRITES_THROTTLED = api_depleted;
    }
};

//Counter functions

Danbooru.initializePageCounter = async function (type, limit, url_addons, reverse, long_format, page, domain, domname, notify) {
    const printer = Debug.getFunctionPrint('Danbooru.initializePageCounter');
    if (domname && Number.isInteger(page)) {
        let latest_id = jQueryProxy(domname).data('latest-id');
        if (!Number.isInteger(latest_id)) {
            let request_addons = Utility.mergeHashes(url_addons, {limit: 1}, {only: 'id'});
            if (!reverse) {
                request_addons.page = 'a0';
            }
            let latest_item = await Danbooru.submitRequest(type, request_addons, {default_val: [], long_format, domain, notify});
            if (latest_item.length) {
                latest_id = latest_item[0].id;
                let current_counter = Math.abs(Math.ceil((latest_id - page) / limit));
                jQueryProxy(domname).text(current_counter);
                jQueryProxy(domname).data('latest-id', latest_id);
                printer.logLevel(current_counter, latest_id, page, Debug.INFO);
            }
        }
    }
};

Danbooru.updatePageCounter = function (domname, limit, page) {
    const printer = Debug.getFunctionPrint('Danbooru.updatePageCounter');
    if (domname) {
        let latest_id = jQueryProxy(domname).data('latest-id');
        if (Number.isInteger(latest_id)) {
            let current_counter = (Number.isInteger(page) ? Math.abs(Math.ceil((latest_id - page) / limit)) : 0);
            jQueryProxy(domname).text(current_counter);
            printer.logLevel(current_counter, latest_id, page, Debug.INFO);
        }
    }
};

Danbooru.setIDCounter = function (domname, counter) {
    if (domname) {
        jQueryProxy(domname).text(counter);
    }
};

//Page functions

Danbooru.getModel = function() {
    let partial_model = Utility.camelCase(document.body.dataset.controller).replace(/i?e?s$/, '');
    let model_keys = Object.keys(document.body.dataset).filter((val) => val.match(new RegExp(partial_model)));
    if (model_keys.length === 0) {
        return null;
    }
    return Utility.kebabCase(model_keys[0]).replace(/-[a-z]+$/, '');
};

Danbooru.getShowID = function() {
    if (document.body.dataset.action !== "show") {
        return 0;
    }
    let model = Danbooru.getModel();
    if (model === null) {
        return 0;
    }
    let show_key = Utility.camelCase(model) + 'Id';
    return Number(document.body.dataset[show_key]) || 0;
};

Danbooru.isSettingMenu = function () {
    return (document.body.dataset.controller === "users") && (document.body.dataset.action === "edit");
};

//DOM functions

Danbooru.initializeHighlights = function () {
    POST_HIGHLIGHT_ENABLED = true;
    Utility.setCSSStyle(HIGHLIGHT_CSS, 'danbooru');
};

Danbooru.highlightPost = function (post_id, highlight_on) {
    if (!POST_HIGHLIGHT_ENABLED) return;
    if (!(post_id in POST_HIGHLIGHT_DICT)) {
        if (highlight_on) {
            let $post = jQueryProxy('#post_' + post_id);
            let $highlight = POST_HIGHLIGHT_DICT[post_id] = jQueryProxy('<div class="danbooru-post-highlight"></div>');
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

Danbooru.initializeAutocomplete = function (selector, autocomplete_type) {
    let $fields = jQueryProxy(selector);
    Utility.setDataAttribute($fields, 'autocomplete', autocomplete_type);
    if (['tag-edit', 'tag-query'].includes(autocomplete_type)) {
        $fields.autocomplete({
            select (_event, ui) {
                DanbooruProxy.Autocomplete.insert_completion(this, ui.item.value);
                return false;
            },
            async source(_request, respond) {
                let term = DanbooruProxy.Autocomplete.current_term(this.element);
                let results = await DanbooruProxy.Autocomplete.autocomplete_source(term, 'tag_query');
                respond(results);
            },
        });
    } else {
        let query_type = autocomplete_type.replaceAll(/-/g, '_');
        DanbooruProxy.Autocomplete.initialize_fields($fields, query_type);
    }
};

//Render functions

Danbooru.postSearchLink = function (text, params, options = {}) {
    let query = Utility.renderParams(params);
    options.href = '/posts?' + query;
    return Utility.renderHTMLTag('a', text, options);
};

Danbooru.wikiLink = function (text, title, options = {}) {
    options.href = '/wiki_pages/' + encodeURIComponent(title);
    return Utility.renderHTMLTag('a', text, options);
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
    let fav_matches = Utility.findAll(params.post.tag_string ?? "", /(?<=^| )-?fav:me(?= |$)/g);
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
        Danbooru.submitRequest('post_votes', {search: {post_id: post_data.id, user_id: DanbooruProxy.CurrentUser.data('id')}, limit: 1})
            .then((vote_data) => {
                $post_votes.find('.active-link').toggleClass('active-link inactive-link');
                if (vote_data.length) {
                    let vote_selector = (vote_data[0].score > 0 ? '.post-upvote-link' : '.post-downvote-link');
                    let $vote = $post_votes.find(vote_selector);
                    $vote.toggleClass('active-link inactive-link');
                    $vote.addClass('post-unvote-link');
                    Utility.setDataAttribute($vote, 'method', 'delete');
                    $vote.attr('href', `/post_votes/${vote_data[0].id}`);
                }
            });
    }
}

/****INITIALIZATION****/

Object.defineProperties(Danbooru, {
    max_read_requests: {
        get () {return (READS_THROTTLED ? Danbooru.read_throttled_requests : MAX_READ_REQUESTS);},
        set (val) {MAX_READ_REQUESTS = val;}
    },
    max_write_requests: {
        get () {return (WRITES_THROTTLED ? 1 : MAX_WRITE_REQUESTS);},
        set (val) {MAX_WRITE_REQUESTS = val;}
    },
});

JSPLib.initializeModule('Danbooru', {
    nonwritable: ['categories'],
});

})(JSPLib);
