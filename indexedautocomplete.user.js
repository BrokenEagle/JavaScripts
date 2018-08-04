// ==UserScript==
// @name         IndexedAutocomplete
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      14.8
// @source       https://danbooru.donmai.us/users/23799
// @description  Uses indexed DB for autocomplete
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/indexedautocomplete.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/danbooru.js
// ==/UserScript==

/***Global variables***/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "IAC:";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];

//Polling interval for checking program status
const timer_poll_interval = 100;

//Interval for fixup callback functions
const callback_interval = 1000;

const autocomplete_userlist = [
    "#search_to_name",
    "#search_from_name",
    "#dmail_to_name",
    "#search_user_name",
    "#search_banner_name",
    "#search_creator_name",
    "#search_approver_name",
    "#search_updater_name"
];
//DOM elements with autocomplete
const autocomplete_domlist = [
    "[data-autocomplete=tag-query]",
    "[data-autocomplete=tag-edit]",
    "[data-autocomplete=tag]",
    ".autocomplete-mentions textarea",
    "#search_title,#quick_search_title",
    "#search_name,#quick_search_name",
    "#search_name_matches,#quick_search_name_matches",
    "#add-to-pool-dialog input[type=text]"
    ].concat(autocomplete_userlist);


//Expiration variables

const expiration_config = {
    tag: {
        logarithmic_start: 100,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    },
    pool: {
        logarithmic_start: 10,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    },
    user: {
        minimum: JSPLib.utility.one_month
    },
    favgroup: {
        minimum: JSPLib.utility.one_week
    },
    search: {
        minimum: JSPLib.utility.one_week
    },
    relatedtag: {
        minimum: JSPLib.utility.one_week
    },
    wikipage: {
        logarithmic_start: 100,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    },
    artist: {
        logarithmic_start: 10,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    }
};

//Validation variables

const autocomplete_constraints = {
    entry: {
        expires : JSPLib.validate.expires_constraints,
        value: {
            presence: true,
            array: {
                length: {
                    maximum : 10,
                    tooLong : "array is too long (maximum is %{count} items"
                }
            }
        }
    },
    tag: {
        antecedent: {
            string: {
                allowNull: true
            }
        },
        category: JSPLib.validate.inclusion_constraints([0,1,3,4,5]),
        label: JSPLib.validate.stringonly_constraints,
        post_count: JSPLib.validate.postcount_constraints,
        type: JSPLib.validate.inclusion_constraints(["tag"]),
        value: JSPLib.validate.stringonly_constraints
    },
    pool: {
        category: JSPLib.validate.inclusion_constraints(["collection","series"]),
        post_count: JSPLib.validate.postcount_constraints,
        type: JSPLib.validate.inclusion_constraints(["pool"]),
        name: JSPLib.validate.stringonly_constraints
    },
    user: {
        level: JSPLib.validate.inclusion_constraints(["Member","Gold","Platinum","Builder","Moderator","Admin"]),
        type: JSPLib.validate.inclusion_constraints(["user"]),
        name: JSPLib.validate.stringonly_constraints
    },
    favgroup: {
        post_count: JSPLib.validate.postcount_constraints,
        name: JSPLib.validate.stringonly_constraints
    },
    savedsearch: {
        name: JSPLib.validate.stringonly_constraints
    },
    artist: {
        label: JSPLib.validate.stringonly_constraints,
        value: JSPLib.validate.stringonly_constraints
    },
    wikipage: {
        label: JSPLib.validate.stringonly_constraints,
        value: JSPLib.validate.stringonly_constraints,
        category: JSPLib.validate.inclusion_constraints([0,1,3,4,5])
    }
};

const relatedtag_constraints = {
    entry: {
        expires : JSPLib.validate.expires_constraints,
        value : {presence: true}
    },
    value: {
        category: JSPLib.validate.inclusion_constraints(["","general","character","copyright","artist"]),
        query: JSPLib.validate.stringonly_constraints,
        tags: JSPLib.validate.tagentryarray_constraints,
        wiki_page_tags: JSPLib.validate.tagentryarray_constraints,
        other_wikis: JSPLib.validate.array_constraints
    },
    other_wikis: {
        title: JSPLib.validate.stringonly_constraints,
        wiki_page_tags: JSPLib.validate.tagentryarray_constraints
    }
};

//Source variables

const source_key = {
    ac: 'tag',
    pl: 'pool',
    us: 'user',
    fg: 'favgroup',
    ss: 'savedsearch',
    ar: 'artist',
    wp: 'wikipage'
};

const source_config = {
    tag: {
        url: "tags/autocomplete",
        data: (term)=>{
            return {
                search: {
                    name_matches: term + "*"
                }
            };
        },
        map: (tag)=>{
            return {
                type: "tag",
                label: tag.name.replace(/_/g, " "),
                antecedent: tag.antecedent_name || null,
                value: tag.name,
                category: tag.category,
                post_count: tag.post_count
            };
        },
        expiration: (d)=>{
            return (d.length ? ExpirationTime('tag',d[0].post_count) : MinimumExpirationTime('tag'));
        },
        fixupmetatag: false,
        fixupexpiration: false
    },
    pool: {
        url: "pools",
        data: (term)=>{
            return {
                search: {
                    order: "post_count",
                    name_matches: term
                },
                limit: 10
            };
        },
        map: (pool)=>{
            return {
                type: "pool",
                name: pool.name,
                post_count: pool.post_count,
                category: pool.category
            };
        },
        expiration: (d)=>{
            return (d.length ? ExpirationTime('pool',d[0].post_count) : MinimumExpirationTime('pool'));
        },
        fixupmetatag: true,
        fixupexpiration: false,
        render: (list, pool)=>{
            var $link = $("<a/>").addClass("pool-category-" + pool.category).text(pool.label);
            var $container = $("<div/>").append($link);
            return $("<li/>").data("item.autocomplete", pool).append($container).appendTo(list);
        }
    },
    user: {
        url: "users",
        data: (term)=>{
            return {
                search: {
                    order: "post_upload_count",
                    current_user_first: true,
                    name_matches: term + "*"
                },
                limit: 10
            };
        },
        map: (user)=>{
            return {
                type: "user",
                name: user.name,
                level: user.level_string
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('user');
        },
        fixupmetatag: true,
        fixupexpiration: false,
        render: (list, user)=>{
            var $link = $("<a/>").addClass("user-" + user.level.toLowerCase()).addClass("with-style").text(user.label);
            var $container = $("<div/>").append($link);
            return $("<li/>").data("item.autocomplete", user).append($container).appendTo(list);
        }
    },
    favgroup: {
        url: "favorite_groups",
        data: (term)=>{
            return {
                search: {
                    name_matches: term
                },
                limit: 10
            };
        },
        map: (favgroup)=>{
            return {
                name: favgroup.name,
                post_count: favgroup.post_count
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('favgroup');
        },
        fixupmetatag: true,
        fixupexpiration: false
    },
    search: {
        url: "saved_searches/labels",
        data: (term)=>{
            return {
                search: {
                    label: term + "*"
                },
                limit: 10
            };
        },
        map: (label)=>{
            return {
                name: label
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('search');
        },
        fixupmetatag: true,
        fixupexpiration: false
    },
    wikipage: {
        url: "wiki_pages",
        data: (term)=>{
            return {
                search: {
                    order: "post_count",
                    hide_deleted: true,
                    title: term + "*"
                },
                limit: 10
            };
        },
        map: (wikipage)=>{
            return {
                label: wikipage.title.replace(/_/g, " "),
                value: wikipage.title,
                category: wikipage.category_name
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('wikipage');
        },
        fixupmetatag: false,
        fixupexpiration: true,
        render: (list, wiki_page)=>{
            var $link = $("<a/>").addClass("tag-type-" + wiki_page.category).text(wiki_page.label);
            var $container = $("<div/>").append($link);
            return $("<li/>").data("item.autocomplete", wiki_page).append($container).appendTo(list);
        }
    },
    artist: {
        url: "artists",
        data: (term)=>{
            return {
                search: {
                    order: "post_count",
                    is_active: true,
                    name: term + "*"
                },
                limit: 10
            };
        },
        map: (artist)=>{
            return {
                label: artist.name.replace(/_/g, " "),
                value: artist.name
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('artist');
        },
        fixupmetatag: false,
        fixupexpiration: true,
        render: (list, artist)=>{
            var $link = $("<a/>").addClass("tag-type-1").text(artist.label);
            var $container = $("<div/>").append($link);
            return $("<li/>").data("item.autocomplete", artist).append($container).appendTo(list);
        }
    }
};

/****TEMPORARY DANBOORU PATCH****/

function SetDanbooruFunctions() {

Danbooru.RelatedTag = Danbooru.RelatedTag || {};

Danbooru.RelatedTag.tags_include = function(name) {
  var current = $("#upload_tag_string,#post_tag_string").val().toLowerCase().match(/\S+/g) || [];
  if ($.inArray(name.toLowerCase(), current) > -1) {
    return true;
  } else {
    return false;
  }
}

Danbooru.RelatedTag.current_tag = function() {
  // 1. abc def |  -> def
  // 2. abc def|   -> def
  // 3. abc de|f   -> def
  // 4. abc |def   -> def
  // 5. abc| def   -> abc
  // 6. ab|c def   -> abc
  // 7. |abc def   -> abc
  // 8. | abc def  -> abc

  var $field = $("#upload_tag_string,#post_tag_string");
  var string = $field.val();
  var n = string.length;
  var a = $field.prop('selectionStart');
  var b = $field.prop('selectionStart');

  if ((a > 0) && (a < (n - 1)) && (!/\s/.test(string[a])) && (/\s/.test(string[a - 1]))) {
    // 4 is the only case where we need to scan forward. in all other cases we
    // can drag a backwards, and then drag b forwards.

    while ((b < n) && (!/\s/.test(string[b]))) {
      b++;
    }
  } else if (string.search(/\S/) > b) { // case 8
    b = string.search(/\S/);
    while ((b < n) && (!/\s/.test(string[b]))) {
      b++;
    }
  } else {
    while ((a > 0) && ((/\s/.test(string[a])) || (string[a] === undefined))) {
      a--;
      b--;
    }

    while ((a > 0) && (!/\s/.test(string[a - 1]))) {
      a--;
      b--;
    }

    while ((b < (n - 1)) && (!/\s/.test(string[b]))) {
      b++;
    }
  }

  b++;
	return string.slice(a, b);
}

Danbooru.RelatedTag.process_response = function(data) {
  Danbooru.RelatedTag.recent_search = data;
  Danbooru.RelatedTag.build_all();
}

Danbooru.RelatedTag.update_selected = function(e) {
  var current_tags = $("#upload_tag_string,#post_tag_string").val().toLowerCase().match(/\S+/g) || [];
  var $all_tags = $("#related-tags a");
  $all_tags.removeClass("selected");

  $all_tags.each(function(i, tag) {
    if (current_tags.indexOf(tag.textContent.replace(/ /g, "_")) > -1) {
      $(tag).addClass("selected");
    }
  });
}

Danbooru.RelatedTag.build_all = function() {
  if (Danbooru.RelatedTag.recent_search === null || Danbooru.RelatedTag.recent_search === undefined) {
    return;
  }

  Danbooru.RelatedTag.show();

  var query = Danbooru.RelatedTag.recent_search.query;
  var related_tags = Danbooru.RelatedTag.recent_search.tags;
  var wiki_page_tags = Danbooru.RelatedTag.recent_search.wiki_page_tags;
  var other_wikis = Danbooru.RelatedTag.recent_search.other_wikis;
  var $dest = $("#related-tags");
  $dest.empty();

  this.build_recent_and_frequent($dest);

  $dest.append(this.build_html(query, related_tags, "general"));
  this.build_translated($dest);
  if (wiki_page_tags.length) {
    $dest.append(Danbooru.RelatedTag.build_html("wiki:" + query, wiki_page_tags, "wiki"));
  }
  $.each(other_wikis, function(i,wiki) {
    $dest.append(Danbooru.RelatedTag.build_html("wiki:" + wiki.title, wiki.wiki_page_tags, "otherwiki" + i.toString()));
  });
  if (Danbooru.RelatedTag.recent_artists) {
    var tags = [];
    if (Danbooru.RelatedTag.recent_artists.length === 0) {
      tags.push([" none", 0]);
    } else if (Danbooru.RelatedTag.recent_artists.length === 1) {
      tags.push([Danbooru.RelatedTag.recent_artists[0].name, 1]);
      if (Danbooru.RelatedTag.recent_artists[0].is_banned === true) {
        tags.push(["BANNED_ARTIST", "banned"]);
      }
      $.each(Danbooru.RelatedTag.recent_artists[0].sorted_urls, function(i, url) {
        var x = url.url;
        if (!url.is_active) {
          x = "-" + x;
        }
        tags.push([" " + x, 0]);
      });
    } else if (Danbooru.RelatedTag.recent_artists.length >= 10) {
      tags.push([" none", 0]);
    } else {
      $.each(Danbooru.RelatedTag.recent_artists, function(i, artist) {
        tags.push([artist.name, 1]);
      });
    }
   $dest.append(Danbooru.RelatedTag.build_html("artist", tags, "artist", true));
  }
}

Danbooru.RelatedTag.build_recent_and_frequent = function($dest) {
  var recent_tags = ReadCookie("recent_tags_with_categories");
  var favorite_tags = ReadCookie("favorite_tags_with_categories");
  if (recent_tags.length) {
    $dest.append(this.build_html("recent", this.other_tags(recent_tags), "recent"));
  }
  if (favorite_tags.length) {
    $dest.append(this.build_html("frequent", this.other_tags(favorite_tags), "frequent"));
  }
}

Danbooru.RelatedTag.other_tags = function(string) {
  if (string && string.length) {
    return $.map(string.match(/\S+ \d+/g), function(x, i) {
      var submatch = x.match(/(\S+) (\d+)/);
      return [[submatch[1], submatch[2]]];
    });
  } else {
    return [];
  }
}

Danbooru.RelatedTag.build_translated = function($dest) {
  if (Danbooru.RelatedTag.translated_tags && Danbooru.RelatedTag.translated_tags.length) {
    $dest.append(this.build_html("Translated Tags", Danbooru.RelatedTag.translated_tags, "translated"));
  }
}

Danbooru.RelatedTag.build_html = function(query, related_tags, name, is_wide_column) {
  if (query === null || query === "") {
    return "";
  }

  query = query.replace(/_/g, " ");
  var header = $("<em/>");

  var match = query.match(/^wiki:(.+)/);
  if (match) {
    header.html($("<a/>").attr("href", "/wiki_pages?title=" + encodeURIComponent(match[1])).attr("target", "_blank").text(query));
  } else {
    header.text(query);
  }

  var $div = $("<div/>");
  $div.attr("id", name + "-related-tags-column");
  $div.addClass("tag-column");
  if (is_wide_column) {
    $div.addClass("wide-column");
  }
  var $ul = $("<ul/>");
  $ul.append(
    $("<li/>").append(
      header
    )
  );

  $.each(related_tags, function(i, tag) {
    if (tag[0][0] !== " ") {
      var $link = $("<a/>");
      $link.text(tag[0].replace(/_/g, " "));
      $link.addClass("tag-type-" + tag[1]);
      $link.attr("href", "/posts?tags=" + encodeURIComponent(tag[0]));
      $link.click(Danbooru.RelatedTag.toggle_tag);
      if (Danbooru.RelatedTag.tags_include(tag[0])) {
        $link.addClass("selected");
      }
      $ul.append(
        $("<li/>").append($link)
      );
    } else {
      var text = tag[0];
      if (text.match(/^ -http/)) {
        text = text.substring(1, 1000);
        var desc = text.replace(/^-https?:\/\//, "");
        if (desc.length > 30) {
          desc = desc.substring(0, 30) + "...";
        }
        $ul.append(
          $("<li>").append(
            $("<del>").text(desc)
          )
        );
      } else if (text.match(/^ http/)) {
        text = text.substring(1, 1000);
        var desc = text.replace(/^https?:\/\//, "");
        if (desc.length > 30) {
          desc = desc.substring(0, 30) + "...";
        }
        $ul.append(
          $("<li>").append([
            $("<a>").text(desc).attr("href", text).attr("target", "_blank"),
            " ",
            $("<a>").attr("href", text).addClass("del").append(
              $("<i>").addClass("fas fa-minus-circle")
            )
          ])
        );
      } else {
        $ul.append($("<li/>").text(text));
      }
    }
  });

  $div.append($ul);
  return $div;
}

Danbooru.RelatedTag.toggle_tag = function(e) {
  var $field = $("#upload_tag_string,#post_tag_string");
  var tag = $(e.target).html().replace(/ /g, "_").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");

  if (Danbooru.RelatedTag.tags_include(tag)) {
    var escaped_tag = RegexpEscape(tag);
    $field.val($field.val().replace(new RegExp("(^|\\s)" + escaped_tag + "($|\\s)", "gi"), "$1$2"));
  } else {
    $field.val($field.val() + " " + tag);
  }
  $field.val($field.val().trim().replace(/ +/g, " ") + " ");

  Danbooru.RelatedTag.update_selected();
  if (Danbooru.RelatedTag.recent_artist && $("#artist-tags-container").css("display") === "block") {
    Danbooru.RelatedTag.process_artist(Danbooru.RelatedTag.recent_artist);
  }

  //The timeout is needed on Chrome since it will clobber the field attribute otherwise
  setTimeout(function () { $field.prop('selectionStart', $field.val().length);}, 100);
  e.preventDefault();
}

Danbooru.RelatedTag.process_artist = function(data) {
  Danbooru.RelatedTag.recent_artists = data;
  Danbooru.RelatedTag.build_all();
}

Danbooru.RelatedTag.toggle = function() {
  if ($("#related-tags").is(":visible")) {
    Danbooru.RelatedTag.hide();
  } else {
    Danbooru.RelatedTag.show();
    $("#related-tags-button").trigger("click");
    $("#find-artist-button").trigger("click");
  }
}

Danbooru.RelatedTag.show = function() {
  $("#related-tags").show()
  $("#toggle-related-tags-link").text("«");
  $("#edit-dialog").height("auto");
}

Danbooru.RelatedTag.hide = function() {
  $("#related-tags").hide();
  $("#toggle-related-tags-link").text("»");
}

Danbooru.Upload = Danbooru.Upload || {};

Danbooru.Upload.initialize_info_manual = function() {
  $("#fetch-data-manual").click(function(e) {
    var source = $("#upload_source,#post_source").val();
    var referer = $("#upload_referer_url").val();

    if (/^https?:\/\//.test(source)) {
      $("#source-info span#loading-data").show();
      Danbooru.Upload.fetch_source_data(source, referer);
    }

    e.preventDefault();
  });
};

Danbooru.Upload.fetch_source_data = function(url, referer_url) {
  return $.getJSON("/source.json", { url: url, ref: referer_url })
    .then(Danbooru.Upload.fill_source_info)
    .catch(function(data) {
      $("#source-info span#loading-data").html("Error: " + data.responseJSON["message"])
    });
};

Danbooru.Upload.fill_source_info = function(data) {
  $("#source-tags").empty();
  $.each(data.tags, function(i, v) {
    $("<a>").attr("href", v[1]).text(v[0]).appendTo("#source-tags");
  });

  $("#source-artist-profile").attr("href", data.profile_url).text(data.artist_name);

  Danbooru.RelatedTag.process_artist(data.artists);
  Danbooru.RelatedTag.translated_tags = data.translated_tags;
  Danbooru.RelatedTag.build_all();

  if (data.artists.length === 0) {
    var new_artist_params = $.param({
      artist: {
        name: data.unique_id,
        other_names: data.artist_name,
        url_string: $.uniqueSort([data.profile_url, data.normalized_for_artist_finder_url]).join("\n")
      }
    });

    var link = $("<a>").attr("href", "/artists/new?" + new_artist_params).text("Create new artist");
    $("#source-danbooru-artists").html(link);
  } else {
    var artistLinks = data.artists.map(function (artist) {
      return $('<a class="tag-type-1">').attr("href", "/artists/" + artist.id).text(artist.name);
    });

    $("#source-danbooru-artists").html(artistLinks);
  }

  if (data.image_urls.length > 1) {
    $("#gallery-warning").show();
  } else {
    $("#gallery-warning").hide();
  }

  $("#upload_artist_commentary_title").val(data.artist_commentary.dtext_title);
  $("#upload_artist_commentary_desc").val(data.artist_commentary.dtext_description);
  Danbooru.Upload.toggle_commentary();

  $("#source-info span#loading-data").hide();
  $("#source-info ul").show();
};


Danbooru.Upload.toggle_commentary = function() {
  if ($(".artist-commentary").is(":visible")) {
    $("#toggle-artist-commentary").text("show »");
  } else {
    $("#toggle-artist-commentary").text("« hide");
  }

  $(".artist-commentary").slideToggle();
};

}

/***Misc functions***/

//Library functions

function DebugExecute(func) {
    if (JSPLib.debug.debug_console) {
        func();
    }
}

function RegexpEscape(string) {
  return string.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
}

function CreateCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        var expires = "; expires=" + date.toGMTString();
    }

    document.cookie = name + "=" + value + expires + "; path=/";
}

function ReadCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1, c.length)
        }
        if (c.indexOf(nameEQ) == 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length).replace(/\+/g, " "));
        }
    }
    return null;
}

 function EraseCookie(name) {
    CreateCookie(name, "", -1);
}

//Time functions

function MinimumExpirationTime(type) {
    return expiration_config[type].minimum;
}

//Logarithmic increase of expiration time based upon a count
function ExpirationTime(type,count) {
    let config = expiration_config[type];
    let expiration = Math.log10(10 * count/config.logarithmic_start) * config.minimum;
    expiration = Math.max(expiration, config.minimum);
    expiration = Math.min(expiration, config.maximum);
    return Math.round(expiration);
}

//Validation functions

function ValidateEntry(key,entry) {
    if (entry === null) {
        JSPLib.debug.debuglog(key,"entry not found!");
        return false;
    }
    if (key.match(/^(?:ac|pl|us|fg|ss|ar|wp)-/)) {
        return ValidateAutocompleteEntry(key,entry);
    } else if (key.match(/^rt(?:gen|char|copy|art)?-/)) {
        return ValidateRelatedtagEntry(key,entry);
    }
    JSPLib.debug.debuglog("Shouldn't get here");
    return false;
}

function ValidateAutocompleteEntry(key,entry) {
    check = validate(entry,autocomplete_constraints.entry);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    for (let i=0;i < entry.value.length; i++) {
        let type = source_key[key.slice(0,2)];
        check = validate(entry.value[i],autocomplete_constraints[type]);
        if (check !== undefined) {
            JSPLib.debug.debuglog("value["+i.toString()+"]");
            JSPLib.validate.printValidateError(key,check);
            return false;
        }
    }
    return true;
}

function ValidateRelatedtagEntry(key,entry) {
    check = validate(entry,relatedtag_constraints.entry);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    check = validate(entry.value,relatedtag_constraints.value);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    for (let i = 0;i < entry.value.other_wikis.length; i++) {
        check = validate(entry.value.other_wikis[i],relatedtag_constraints.other_wikis);
        if (check !== undefined) {
            JSPLib.debug.debuglog("value["+i.toString()+"]");
            JSPLib.validate.printValidateError(key,check);
            return false;
        }
    }
    return true;
}

/***Main helper functions***/

function FixupMetatag(value,metatag) {
    switch(metatag) {
        case "@":
            value.value = "@" + value.name;
            value.label = value.name;
            break;
        case "":
            value.value = value.name;
            value.label = value.name.replace(/_/g, " ");
            break;
        default:
            value.value = metatag + ":" + value.name;
            value.label = value.name.replace(/_/g, " ");
    }
}

function FixExpirationCallback(key,value,tagname,type) {
    JSPLib.debug.debuglog("Fixing expiration:",tagname);
    JSPLib.danbooru.submitRequest('tags',{search: {name: tagname}}).then((data)=>{
        if (!data.length) {
            return;
        }
        var expiration_time = ExpirationTime(type,data[0].post_count);
        JSPLib.storage.saveData(key, {"value": value, "expires": Date.now() + expiration_time});
    });
}

/***Main execution functions***/

//Autocomplete functions

function NetworkSource(type,key,term,resp,metatag) {
    JSPLib.debug.debuglog("Querying",type,':',term);
    JSPLib.danbooru.submitRequest(source_config[type].url,source_config[type].data(term)).then((data)=>{
        var d = $.map(data, source_config[type].map);
        var expiration_time = source_config[type].expiration(d);
        JSPLib.storage.saveData(key, {"value": JSPLib.utility.dataCopy(d), "expires": Date.now() + expiration_time});
        if (source_config[type].fixupmetatag) {
            $.each(d, (i,val)=> {FixupMetatag(val,metatag);});
        }
        if (source_config[type].fixupexpiration && d.length) {
            setTimeout(()=>{FixExpirationCallback(key,d,d[0].value,type);},callback_interval);
        }
        resp(d);
    });
}

async function NormalSourceIndexed(term, resp) {
    var key = ("ac-" + term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached) {
        resp(cached.value);
        return;
    }
    NetworkSource('tag',key,term,resp,"");
}

async function PoolSourceIndexed(term, resp, metatag) {
    var key = ("pl-" + term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached) {
        $.each(cached.value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(cached.value);
        return;
    }
    NetworkSource('pool',key,term,resp,metatag);
}

async function UserSourceIndexed(term, resp, metatag) {
    var key = ("us-" + term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached) {
        $.each(cached.value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(cached.value);
        return;
    }
    NetworkSource('user',key,term,resp,metatag);
}

async function FavoriteGroupSourceIndexed(term, resp, metatag) {
    var key = ("fg-" + term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached) {
        $.each(cached.value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(cached.value);
        return;
    }
    NetworkSource('favgroup',key,term,resp,metatag);
}

async function SavedSearchSourceIndexed(term, resp, metatag = "search") {
    var key = ("ss-" + term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached) {
        $.each(cached.value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(cached.value);
        return;
    }
    NetworkSource('search',key,term,resp,metatag);
}

async function WikiPageIndexed(req, resp) {
    var key = ("wp-" + req.term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached) {
        resp(cached.value);
        return;
    }
    NetworkSource('wikipage',key,req.term,resp,"");
}

async function ArtistIndexed(req, resp) {
    var key = ("ar-" + req.term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached) {
        resp(cached.value);
        return;
    }
    NetworkSource('artist',key,req.term,resp,"");
}

//Non-autocomplete storage

function CommonBindIndexed(button_name, category) {
    $(button_name).click(async (e)=>{
        var $dest = $("#related-tags");
        $dest.empty();
        Danbooru.RelatedTag.build_recent_and_frequent($dest);
        $dest.append("<em>Loading...</em>");
        $("#related-tags-container").show();
        var currenttag = $.trim(Danbooru.RelatedTag.current_tag());
        var keymodifier = (category.length ? JSPLib.danbooru.getShortName(category) : "");
        var key = ("rt" + keymodifier + "-" + currenttag).toLowerCase();
        var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
        if (cached) {
            Danbooru.RelatedTag.process_response(cached.value);
        } else {
            JSPLib.debug.debuglog("Querying relatedtag:",currenttag,category);
            var data = await JSPLib.danbooru.submitRequest("related_tag", {query: currenttag, category: category});
            JSPLib.storage.saveData(key, {"value": data, "expires": Date.now() + MinimumExpirationTime('relatedtag')});
            Danbooru.RelatedTag.process_response(data);
        }
        $("#artist-tags-container").hide();
        e.preventDefault();
    });
}

function SaveSessionData(url,data) {
    let key = 'af-' + url;
    JSPLib.debug.debuglog("Saving",key);
    sessionStorage.setItem(key,JSON.stringify(data));
}

function CheckSource(domobj) {
    if (domobj.val()) {
        let key = 'af-' + domobj.val();
        JSPLib.debug.debuglog("Checking artist",key);
        let data = JSPLib.storage.getStorageData(key,sessionStorage);
        if (data) {
            JSPLib.debug.debuglog("Found artist data",key);
            Danbooru.RelatedTag.process_artist(data);
            return true;
        }
        JSPLib.debug.debuglog("Missing artist data",key);
    }
    return false;
}

function FindArtistSession(e) {
    $("#artist-tags").html("<em>Loading...</em>");
    var url = $("#upload_source,#post_source");
    if (CheckSource(url)) {
        return;
    }
    var referer_url = $("#upload_referer_url");
    if ((url.val() !== referer_url.val()) && CheckSource(referer_url)) {
        return;
    }
    JSPLib.debug.debuglog("Checking network",url.val(),referer_url.val());
    JSPLib.danbooru.submitRequest("artists/finder", {url: url.val(), referer_url: referer_url.val()})
        .then((data)=>{
            Danbooru.RelatedTag.process_artist(data);
            if (url.val()) {
                SaveSessionData(url.val(),data);
            }
            if ((url.val() !== referer_url.val()) && referer_url.val()) {
                SaveSessionData(referer_url.val(),data);
            }
        });
    e.preventDefault();
}

/***Setup functions***/

//TEMPORARY DANBOORU PATCH//

function rebindFetchManual() {
    let bounditems = $._data($("#fetch-data-manual")[0]);
    JSPLib.debug.debuglog("Bound items (FM):",Object.keys(bounditems));
    if (!$.isEmptyObject(bounditems) && bounditems.events.click.length) {
        clearInterval(rebindFetchManual.timer);
        $("#fetch-data-manual").off();
        Danbooru.Upload.initialize_info_manual();
    }
}

//Rebind callback functions

function rebindRelatedTags() {
    //Only need to check one of them, since they're all bound at the same time
    let bounditems = $._data($("#related-tags-button")[0]);
    JSPLib.debug.debuglog("Bound items (RT):",Object.keys(bounditems));
    if (!$.isEmptyObject(bounditems) && bounditems.events.click.length) {
        clearInterval(rebindRelatedTags.timer);
        $("#related-tags-button").off();
        CommonBindIndexed("#related-tags-button", "");
        var related_buttons = ['general','artist','character','copyright'];
        $.each(related_buttons, (i,category)=>{
            $(`#related-${category}-button`).off();
            CommonBindIndexed("#related-" + category + "-button", category);
        });
    }
}

function rebindFindArtist() {
    //Only need to check one of them, since they're all bound at the same time
    let bounditems = $._data($("#find-artist-button")[0]);
    JSPLib.debug.debuglog("Bound items (FA):",Object.keys(bounditems));
    if (!$.isEmptyObject(bounditems) && bounditems.events.click.length) {
        clearInterval(rebindFindArtist.timer);
        $("#find-artist-button").off();
        $("#find-artist-button").click(FindArtistSession);
    }
}

function rebindWikiPageAutocomplete() {
    var $fields = $("#search_title,#quick_search_title");
    if ($fields.length && ('uiAutocomplete' in $.data($fields[0]))) {
        clearInterval(rebindWikiPageAutocomplete.timer);
        $fields.off().removeData();
        WikiPageInitializeAutocompleteIndexed();
    }
}

function rebindArtistAutocomplete() {
    var $fields = $("#search_name,#quick_search_name");
    if ($fields.length && (('uiAutocomplete' in $.data($fields[0])) || $("#c-artist-versions").length) ) {
        clearInterval(rebindArtistAutocomplete.timer);
        $fields.off().removeData();
        ArtistInitializeAutocompleteIndexed();
    }
}

function rebindPoolAutocomplete() {
    var $fields = $("#search_name_matches,#quick_search_name_matches");
    if ($fields.length && (('uiAutocomplete' in $.data($fields[0])) || $("#c-pool-versions").length)) {
        clearInterval(rebindPoolAutocomplete.timer);
        $fields.off().removeData();
        PoolInitializeAutocompleteIndexed("#search_name_matches,#quick_search_name_matches");
    }
}

function rebindPostPoolAutocomplete() {
    var $fields = $("#add-to-pool-dialog input[type=text]");
    if ($fields.length && ('uiAutocomplete' in $.data($fields[0]))) {
        clearInterval(rebindPostPoolAutocomplete.timer);
        $fields.off().removeData();
        PoolInitializeAutocompleteIndexed("#add-to-pool-dialog input[type=text]");
    }
}

//Initialization functions

function InitializeAutocompleteIndexed(selector,sourcefunc,type) {
    var $fields = $(selector);
    $fields.autocomplete({
        minLength: 1,
        delay: 100,
        source: sourcefunc,
        search: function() {
            $(this).data("uiAutocomplete").menu.bindings = $();
        }
    });
    if (source_config[type].render) {
        $fields.each((i, field)=>{
            $(field).data("uiAutocomplete")._renderItem = source_config[type].render;
        });
    }
}

function WikiPageInitializeAutocompleteIndexed() {
    InitializeAutocompleteIndexed("#search_title,#quick_search_title",WikiPageIndexed,'wikipage');
}

function ArtistInitializeAutocompleteIndexed() {
    InitializeAutocompleteIndexed("#search_name,#quick_search_name",ArtistIndexed,'artist');
}

function PoolInitializeAutocompleteIndexed(selector) {
    InitializeAutocompleteIndexed(selector, (req,resp)=>{ PoolSourceIndexed(req.term, resp, ""); },'pool');
}

function UserInitializeAutocompleteIndexed(selector) {
    InitializeAutocompleteIndexed(selector, (req,resp)=>{ UserSourceIndexed(req.term, resp, ""); },'user');
}

function SavedSearchInitializeAutocompleteIndexed(selector) {
    InitializeAutocompleteIndexed(selector, (req,resp)=>{ SavedSearchSourceIndexed(req.term, resp, ""); },'search');
}

//Main program
function main() {
    if (!JSPLib.storage.use_indexed_db) {
        JSPLib.debug.debuglog("No Indexed DB! Exiting...");
        return;
    }
    if ($(autocomplete_domlist.join(',')).length === 0) {
        JSPLib.debug.debuglog("No autocomplete inputs! Exiting...");
        return;
    }
    SetDanbooruFunctions();
    Danbooru.Autocomplete = Danbooru.Autocomplete || {};
    Danbooru.Autocomplete.normal_source = NormalSourceIndexed;
    Danbooru.Autocomplete.pool_source = PoolSourceIndexed;
    Danbooru.Autocomplete.user_source = UserSourceIndexed;
    Danbooru.Autocomplete.favorite_group_source = FavoriteGroupSourceIndexed;
    Danbooru.Autocomplete.saved_search_source = SavedSearchSourceIndexed;
    if ($("#c-posts #a-show,#c-uploads #a-new").length) {
        rebindRelatedTags.timer = setInterval(rebindRelatedTags,timer_poll_interval);
        rebindFindArtist.timer = setInterval(rebindFindArtist,timer_poll_interval);
        rebindFetchManual.timer = setInterval(rebindFetchManual,timer_poll_interval);
    }
    if ($("#c-wiki-pages,#c-wiki-page-versions").length) {
        rebindWikiPageAutocomplete.timer = setInterval(rebindWikiPageAutocomplete,timer_poll_interval);
    }
    if ($("#c-artists,#c-artist-versions").length) {
        rebindArtistAutocomplete.timer = setInterval(rebindArtistAutocomplete,timer_poll_interval);
    }
    if ($("#c-pools,#c-pool-versions").length) {
        rebindPoolAutocomplete.timer = setInterval(rebindPoolAutocomplete,timer_poll_interval);
    }
    if ($("#c-posts #a-show").length) {
        rebindPostPoolAutocomplete.timer = setInterval(rebindPostPoolAutocomplete,timer_poll_interval);
    }
    if ($("#c-posts #a-index").length) {
        SavedSearchInitializeAutocompleteIndexed("#saved_search_label_string");
    }
    if ($(autocomplete_userlist.join(',')).length) {
        UserInitializeAutocompleteIndexed(autocomplete_userlist.join(','));
    }
    if ($('[placeholder="Search users"]').length) {
        UserInitializeAutocompleteIndexed("#search_name_matches,#quick_search_name_matches");
    }
    DebugExecute(()=>{
        window.addEventListener('beforeunload', ()=>{
            JSPLib.statistics.outputAdjustedMean("IndexedAutocomplete");
        });
    });
}

/***Execution start***/

JSPLib.load.programInitialize(main,'IAC',program_load_required_variables);
