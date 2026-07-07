/* assets/main-search.js
   Small addition on top of main-collection.js + collection-filter.js,
   both reused unchanged on this page (see main-search.liquid). The
   one thing they can't do: Shopify's search endpoint only returns
   one result type per request, so whichever tab wasn't the actual
   ?type= on page load starts with an empty panel. This fetches that
   tab's content via the Section Rendering API on first click, then
   gets out of the way -- main-collection.js's own tab-click listener
   (bound to the same [data-tab] elements) handles the show/hide once
   both panels have real content, exactly like it does on the
   collection page.

   COMPONENTIZED (2026-07): the two result panels (#panel-products /
   #panel-articles) are now rendered by snippets/search-results.liquid
   inside a wrapper with id="search-feed" -- not the old
   id="collection-feed" this file used to target. Updated below.
   Also now actually sets aria-busy="true"/"false" on that wrapper
   while a tab fetch is in flight (main-search.css has always had a
   `.search-feed[aria-busy="true"]` selector for this, but this file
   never set the attribute, so that half of the loading treatment was
   dead).

   EVENT-ORDERING FIX (2026-07): this used to attach a capture-phase
   click listener directly on each [data-tab] element, on the theory
   that a capture listener always runs before a bubble listener on
   the same element, as long as this script loads after
   main-collection.js. That's wrong: capture vs. bubble only
   determines ordering for listeners on ANCESTORS of the click
   target, while the tab <a> itself IS the click target, so both its
   capture- and bubble-phase listeners fire in the SAME "target"
   phase, in plain registration order. Since main-collection.js's
   (bubble) listener was attached first (it loads first), it actually
   ran BEFORE this file's "capture" listener on the very first click
   of an unloaded tab -- calling activateTab() against stale/empty
   content before the fetch even started, and (combined with the
   data-panel/data-tab mismatch fixed in search-results.liquid) that
   could hide both panels or, once the synthetic click landed on an
   already-"loaded" panel, fall through to a real page navigation via
   the anchor's href.

   Fixed by moving to a single delegated listener on `document`
   (still capture: true). A capture listener on a genuine ancestor
   fires during the CAPTURING phase, which completes before the event
   ever reaches the target -- so this is now guaranteed to run before
   main-collection.js's listener on the tab itself, regardless of
   script load order. This also naturally covers the Articles-tab
   filter placeholder's "Switch to Products" link (data-tab="products"),
   which lives outside .tab-switcher and was already relying on this
   same handler. */
(function () {
  'use strict';

  var page = document.querySelector('[data-search-page]');
  if (!page) return;

  var sectionRoot = document.getElementById('main-collection');
  var sectionId = sectionRoot ? sectionRoot.dataset.sectionId : null;
  var feed = document.getElementById('search-feed');

  function panelIdFor(type) {
    return type === 'article' ? 'panel-articles' : 'panel-products';
  }

  // Mark whichever panel the server actually populated on load.
  var initialType = page.dataset.activeTab === 'articles' ? 'article' : 'product';
  var initialPanel = document.getElementById(panelIdFor(initialType));
  if (initialPanel) initialPanel.dataset.loaded = 'true';

  function fetchType(type, tabEl) {
    if (!sectionId) {
      window.location.href = tabEl.href;
      return;
    }

    var url = new URL(tabEl.href, window.location.href);
    var fetchUrl = new URL(url.toString());
    fetchUrl.searchParams.set('section_id', sectionId);

    if (feed) {
      feed.classList.add('is-loading');
      feed.setAttribute('aria-busy', 'true');
    }

    fetch(fetchUrl.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('Tab fetch failed');
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var panelId = panelIdFor(type);

        var newPanel = doc.getElementById(panelId);
        var currentPanel = document.getElementById(panelId);
        if (newPanel && currentPanel) {
          currentPanel.innerHTML = newPanel.innerHTML;
          currentPanel.dataset.loaded = 'true';
        }

        // The filter aside always needs to match the newly-fetched
        // tab: switching to Products swaps in the real filter form;
        // switching to Articles swaps in the "No filters for
        // articles" placeholder that main-search.liquid renders for
        // the article branch. Runs for BOTH tab types -- otherwise
        // the previous tab's aside content is left stale in the DOM.
        var newFilter = doc.getElementById('collection-filter');
        var currentFilter = document.getElementById('collection-filter');
        if (newFilter && currentFilter) currentFilter.outerHTML = newFilter.outerHTML;

        // The active-filters pill strip only ever applies to product
        // results (Shopify doesn't facet article results), so this
        // stays scoped to the product branch.
        if (type === 'product') {
          var newActiveFilters = doc.getElementById('collection-active-filters');
          var currentActiveFilters = document.getElementById('collection-active-filters');
          if (newActiveFilters && currentActiveFilters) currentActiveFilters.outerHTML = newActiveFilters.outerHTML;
        }

        // Now that this tab has real content, let main-collection.js
        // do the actual show/hide + history push, same as it would
        // for a normal (already-loaded) tab click.
        tabEl.click();
      })
      .catch(function () {
        window.location.href = url.toString();
      })
      .finally(function () {
        if (feed) {
          feed.classList.remove('is-loading');
          feed.setAttribute('aria-busy', 'false');
        }
      });
  }

  // Single delegated capture listener on document -- see the
  // EVENT-ORDERING FIX note above for why this replaced per-element
  // listeners attached directly to each [data-tab] element.
  document.addEventListener('click', function (e) {
    var tabEl = e.target.closest('[data-tab]');
    if (!tabEl || !page.contains(tabEl)) return;

    var type = tabEl.dataset.tab === 'articles' ? 'article' : 'product';
    var panel = document.getElementById(panelIdFor(type));

    if (panel && panel.dataset.loaded === 'true') return; // already loaded — let main-collection.js handle it normally

    e.preventDefault();
    e.stopImmediatePropagation(); // stops the event before it ever reaches the tab (capture completes first) -- main-collection.js's listener never fires for this click
    fetchType(type, tabEl);
  }, true); // capture phase, on document -- genuinely runs before any listener on the tab element itself
})();