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

   Load AFTER main-collection.js: this listens in the CAPTURE phase
   so it can intercept a click on a not-yet-loaded tab before
   main-collection.js's bubble-phase listener toggles visibility on
   an empty panel.

   FIXED (2026-07): the #collection-filter aside swap used to be
   gated behind `if (type === 'product')`, so switching TO the
   Articles tab for the first time never replaced the sidebar. If the
   page loaded on Products (real filter form: price slider, checkbox
   groups, etc. rendered in the aside) and the user then clicked
   Articles, fetchType('article', tabEl) ran but skipped the aside
   swap entirely -- the product filter form stayed in the DOM while
   the Articles panel appeared underneath it, instead of being
   replaced by the "No filters for articles" placeholder that
   main-search.liquid renders for the article branch. The aside swap
   now always runs; only the active-filters pill strip (which is
   genuinely products-only -- Shopify doesn't facet article results)
   stays gated to the product branch.
*/
(function () {
  'use strict';

  var page = document.querySelector('[data-search-page]');
  if (!page) return;

  var sectionRoot = document.getElementById('main-collection');
  var sectionId = sectionRoot ? sectionRoot.dataset.sectionId : null;
  var feed = document.getElementById('collection-feed');

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

    if (feed) feed.classList.add('is-loading');

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
        // tab: switching to Products swaps in the real filter form
        // (price slider, checkbox groups, etc.); switching to
        // Articles swaps in the "No filters for articles" placeholder
        // that main-search.liquid renders for the article branch.
        // This must run for BOTH tab types, not just 'product' --
        // otherwise the previous tab's aside content is left stale
        // in the DOM.
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
        if (feed) feed.classList.remove('is-loading');
      });
  }

  document.querySelectorAll('[data-tab]').forEach(function (tabEl) {
    tabEl.addEventListener('click', function (e) {
      var type = tabEl.dataset.tab === 'articles' ? 'article' : 'product';
      var panel = document.getElementById(panelIdFor(type));

      if (panel && panel.dataset.loaded === 'true') return; // already loaded — let main-collection.js handle it normally

      e.preventDefault();
      e.stopImmediatePropagation(); // don't let main-collection.js toggle an empty panel
      fetchType(type, tabEl);
    }, true); // capture phase — runs before main-collection.js's listener
  });

  // The Articles-tab filter placeholder's "Switch to Products" link
  // carries data-tab="products" too, so it rides the same handler.
})();