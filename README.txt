1. Original Environment Details

  a. Operating System - Windows 7, Windows 8
  b. Browsers - Chrome 59, Firefox 54

2. Application Files

  a. safelist.user.js - Alternate blacklist handler for Danbooru with UI enhancements.
  b. validateblacklist.user.js-  Addon module that validates a Danbooru blacklist.
  c. orderblacklist.user.js - Addon module that orders a Danbooru blacklist.
  d. dtextstyler.user.js - UI controls for DText styles.
  e. iqdb4chan.user.js - Danbooru IQDB checker for 4chan threads.
  f. iqdbbooru.user.js - Danbooru IQDB checker for various Boorus.

3. Setup

  a. Install Tampermonkey (Chrome, Firefox): https://tampermonkey.net/
  b. Install Javascript file(s)

4. Usage Notes

  a. Safelist
  
    i. Availability:
      
      Safelist will be active everywhere if enabled, however, the controls are
      only available on pages where Danbooru has blacklist controls.  Depending
      on the page, the controls will appear in the sidebar or at the top of the
      content.
      
      Safelist settings can only be found on the image search page.  The link is
      located to the right of the links located at the top of the content (image
      thumbnails).
      
    ii. Safelist Controls
      
      Clicking enable will hide Danbooru's blacklist and show the Safelist. Clicking
      a level will cause the settings associated with that level to go into effect.
      Clicking disable will show Danbooru's blacklist and collapse the Safelist
      controls.
      
      Each level can also have a hotkey associated with it which are enabled only if
      Safelist is enabled.  Using the hotkey is the same as clicking the level link.
      
    iii. Settings
        
      General Settings:
      
      - Name: Change the name of Safelist (HTML allowed).
      - Replacement Text: Used with Enable Text Replace function (plaintext only).
      - Enable Tag Hide: Hide all occurrences of a tag in sidemenus and tables.
      - Enable Text Replace: Replace all occurrences of a tag with Replacement
          Text in prose and titles.
      - Enable Write Mode: Enable writes to your Danbooru blacklist with the
          Push button.
      - Enable Validate Mode: Enable ValidateBlacklist addon if installed.
          Click Validate button to activate.
      - Enable Order Mode: Enable OrderBlacklist addon if installed.
          Click Order button to activate.
      - Use Session Enable: Have a different state of enabled on each page tab.
      - Use Session Level: Have a different active level on each page tab.
      
      Level Settings:
      
      - Name: Change the name of the level (HTML allowed).
      - Hotkey: Key combination used to change levels.
      - Enable: (All/None) Enable or disable these constant lists.
      - Background Process: Process a list in the background so that changing
          lists is more responsive.
      - Blacklisted Tags: Work exactly the same as Danbooru's blacklist
      - Custom CSS:  Style to apply to the whole site.
      
      General controls:
      
      - Submit: Save all of the settings and reload as required.
      - Add: Add a new level.
      - Reset All: Reset all settings to factory default.
      - Show Raw: Used to transfer settings between domains/computers.
      
      Level controls:
      
      - Pull: Populate tag list with a user's Danbooru blacklist tags.
      - Push: Write a tag list to a user's Danbooru blacklist.
      - Validate: Activates the ValidateBlacklist addon for the tag list.
      - Order: Activates the OrderBlacklist addon for the tag list.
      - Reset: Resets the module addon, causing it to stop.
      - Apply: Apply the recommended changes to the tag list window.
      - Delete: Delete the level.
  
  b. ValidateBlacklist
  
    Two classes are exported to the window variable for use.
    
    i. TextboxLogger:
    
      Provides user feedback and should be instantiated with the DOM name
      of a <textarea> to write to.  The two main functions are log and clear,
      which either writes to a text area or clears it respectively.
    
    ii. ValidateBlacklist:
    
      Validates a Danbooru blacklist.  Instantiated with an array of strings
      representing each line of the blacklist and an optional instance of
      TextboxLogger.  Processing is started with the class function processList.
      Processing can be stopped at any point with the class function allstop.
      
      When processing is complete, the class variable is_ready will be set to
      true.  If there were no faults found, the class variable unchanged will
      be set to true.
      
      The results are stored in two class variables. reconstructed_list contains
      an array of strings representing each line of a blacklist in the same order
      that they were input.  reconstructed_html contains a user friendly HTML
      representation of the changes made to the input list.
  
  c. OrderBlacklist
  
    Two classes are exported to the window variable for use.
    
    i. TextboxLogger:
    
      Provides user feedback and should be instantiated with the DOM name
      of a <textarea> to write to.  The two main functions are log and clear,
      which either writes to a text area or clears it respectively.
    
    ii. OrderBlacklist:
    
      Orders a Danbooru blacklist.  Instantiated with an array of strings
      representing each line of the blacklist and an optional instance of
      TextboxLogger.  Processing is started with the class function processList.
      Processing can be stopped at any point with the class function allstop.
      
      When processing is complete, the class variable is_ready will be set to
      true.  If there were no faults found, the class variable unchanged will
      be set to true.
      
      The results are stored in two class variables. reconstructed_list contains
      an array of strings representing each line of a blacklist in the new order
      by post count.  reconstructed_html contains a user friendly HTML
      representation of the new list.

  d. DtextStyler:
  
    Provides user interface controls to facilitate DText markup.
    
    - B: Bold
    - I: Italics
    - U: Underline
    - S: Strikethrough
    - Aあ: Translate
    - ": Quote
    - {}: Expand
    - Crossed-out circle: Spoiler
    - <>: Code
    - Chain-links: Textile link
    - W: Wiki link
    - Magnifying glass: Tag search link
    - Spreadsheet: Dtext table
    
  e. IQDB4Chan
      
    Provides a link under the thread named "IQDB Check" that will check every
    thumbnail in the thread for a match on Danbooru's IQDB server.  With any
    match, links to the matching Danbooru post are added after the 4chan image
    file data.  With any non-match, the entire thumbnail is surrounded with a
    thick red border.
  
  f. IQDB4Booru
      
    Provides a link under the tags header named "<IQDB Check>" that will check 
    every thumbnail in the post search for a match on Danbooru's IQDB server.
    With any match, links to the matching Danbooru post are added after the 4chan
    image file data.  With any non-match, the entire thumbnail is surrounded with
    a thick red border.
    
    Usage notes:
    
      - The IQDB link only appears after a tag search from the post page.
      - Auto paging must be turned off on Sankakucomplex or any other userscript 
        that may be used as the IQDB check is only allowed to run once per page load.
