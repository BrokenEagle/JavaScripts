## Supported Environments

- Browsers
  - Chrome
  - Firefox
- Userscript managers
  - Tampermonkey: https://tampermonkey.net/

All other browsers and userscript managers will have minimal support.

## Danbooru Userscripts

These are the userscripts which function on the Danbooru site itself. The settings for these are all accessed from the Danbooru settings page, by cliking the **Userscripts** link next to the **Security** link.

https://danbooru.donmai.us/settings

### CurrentUploads

https://danbooru.donmai.us/forum_topics/15169

Provides a user interface that has metrics and visualizations for a user's uploads or approvals. It places a "Toggle Upload Table" link by default underneath the Danbooru headers. This link can be stashed by clicking "STASH", which will place a "Restore CurrentUploads" in the footer. Clicking this link will restore the original link.

### DisplayPostInfo

https://danbooru.donmai.us/forum_topics/15926

Provides additional user interface information on the post pages.

##### INDEX

On the index page, it provides metrics for the posts on the page, to include the source of the posts, as well as metrics on the rating and the status. These both appear underneath the tag list on the lefthand side of the page.

It also provides metrics for the taglist itself, showing how much the percentage of posts on the page match the tags in the taglist.

There is also an option that will add a `data-is-favorited` attribute to posts, which can allow users to style posts based upon their favorited status.

Finally, it allows the delay for showing/hiding the post tooltips to be adjusted. If tooltips are disabled in the Danbooru settings, it adds the uploader to the text popup.

##### SHOW

On the show page, it adds the post views and the top tagger. These both appear underneath the **Information** section on the lefthand side of the page.

### DTextStyler

https://danbooru.donmai.us/forum_topics/14229

Provides additional controls for DText inputs that facilitate adding DText markup. See the wiki for more details.

https://github.com/BrokenEagle/JavaScripts/wiki/DtextStyler

**Note**: These controls function differently than the DText markup controls that Danbooru provides.

### EventListener

https://danbooru.donmai.us/forum_topics/14747

Provides a background service that regularly checks for events of interest. These include: flags, appeals, comments, notes, post edits, commentaries, approvals, forum posts, wikis, artists, pools, dmail, feedback, bans, mod actions. See the wiki for more details.

https://github.com/BrokenEagle/JavaScripts/wiki/EventListener

### IndexedAutocomplete

https://danbooru.donmai.us/forum_topics/14701

Provides an alternative mechanism from Danbooru for the autocomplete used on various inputs. It has the benefit of storing the data in Indexed DB which is a local cache available to browsers, which facilitates a much quicker lookup on average. It also has multiple additional functions that Danbooru does not provide, such as placing previously selected autocomplete inputs at the top of the list. It also has multiple configuration options for the autocomplete format and sorting.

### IndexedRelatedTags

https://danbooru.donmai.us/forum_topics/23592

Provides an alternate user interface for related tags when editing a post. Additionally, it stores the data in Indexed DB which is a local cache available to browsers, which facilitates a much quicker lookup on average. It also provides several controls not available to Danbooru, such as adjusting the sorting used for related tags, as well as querying just the wiki page for tags. Finally, it provides the ability to maintain a user-provided checklist of tags that can be stored on a per tag basis. The interface for adding/updating these tags are found on the user settings page.

### PostModeMenu+

https://danbooru.donmai.us/forum_topics/21812

Provides an alternate user interface for the mode menu box that is available to Gold+ users. In addition to the different interface, it provides several different options not available on the regular interface to include: vote up, vote down, unvote, copy ID, copy short, copy link, and commentary.

For the edit option, it alters the edit interface, having it use a popup dialog instead. Additionally, if the ValidateTagInput userscript is detected, it adds that functionality into the dialog as well.

### RecentTagsCalc

Currently nonfunctional, but not yet moved to unsupported status.

### Safelist+

https://danbooru.donmai.us/forum_topics/14221

Provides an alternate user interface and mechanism for the blacklist that Danbooru provides. It supports having multiple different blacklists, and each blacklist can have its own custom CSS, which allows the page look to change depending upon which blacklist is being used. Each list can be given custom names, and can also be given custom hotkeys which will change to that list when used.

The lists are edited/added/deleted on the post INDEX page, and are accessed by clicking the **Safelist** link next to the **Posts** link above the posts display.

### SiteTagSearches

https://danbooru.donmai.us/forum_topics/14958

Provides an alternate mechanism on the other tags shown on the wiki page and also the post INDEX page for singular tag searches. This mechanism provides the tag search links for sites other than Pixiv. Clicking the "<" on the left side of the main tag will show the Booru sites, and clicking the ">" on the right side of all links will show all of the other sites.

### TranslatorAssist

https://danbooru.donmai.us/forum_topics/20687

Provides an additional user interface on the post SHOW page which provides a popup dialog with multiple inputs and controls to help add/adjust HTML on note inputs. See the wiki for more details.

https://github.com/BrokenEagle/JavaScripts/wiki/TranslatorAssist

### ValidateTagInput

https://danbooru.donmai.us/forum_topics/14474

Provides an additional mechanism on tag edit inputs that will check tag adds and removals for empty, deprecated, and implications that will prevent removes.

Additionally, on uploads it will check that the rating is selected.

It also has the option to check the general and copyright tags on posts, as well as checking the artist tag to see if it has an artist entry.

## Other userscripts

### New Twitter Image Searches and Stuff

https://danbooru.donmai.us/forum_topics/16342

Provides additional user interfaces on Twitter/X that facilitates searching images/urls for posts on Danbooru, as well as downloading/uploading images/tweets. See the wiki for more details.

https://github.com/BrokenEagle/JavaScripts/wiki/Twitter-Image-Searches-and-Stuff

## Issues

Submit a Github issue, send a Dmail on Danbooru, or ping me in `#technical` on Danbooru's Discord.

https://danbooru.donmai.us/users/23799
https://discord.gg/danbooru
