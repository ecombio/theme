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

   2026-07 UPDATE: on every tab click, page.dataset.activeTab is now
   updated synchronously, before any fetch/preventDefault decision is
   made. main-collection.css reads this attribute
   ([data-active-tab="articles"]) to show the "products only" notice
   in the (now persistent, never-swapped) filter sidebar and to dim
   #FilterForm. Previously that attribute only ever got its initial
   value from the server-rendered page and was never updated
   client-side, so it would be stale after the first tab switch.
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

        // Products tab may bring freshly-rendered filter groups +
        // active-filters strip with it the first time it loads.
        // NOTE: #collection-filter itself is no longer swapped via
        // outerHTML here -- that used to replace the whole <aside>
        // (destroying open <details> state and the price-slider's
        // JS bindings) every time this ran. Only the filter GROUPS
        // are refreshed in place now, leaving the notice/dimming
        // wrapper and the form node itself untouched.
        if (type === 'product') {
          var newGroups = doc.querySelectorAll('#collection-filter .collection-filter__group');
          var currentForm = document.getElementById('FilterForm');
          if (newGroups.length && currentForm) {
            var existingGroups = currentForm.querySelectorAll('.collection-filter__group');
            existingGroups.forEach(function (g) { g.remove(); });
            var submitBtn = currentForm.querySelector('.collection-filter__submit');
            newGroups.forEach(function (g) {
              currentForm.insertBefore(g.cloneNode(true), submitBtn);
            });
          }

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

      // Sync immediately -- doesn't wait on any fetch, so the filter
      // sidebar's notice/dim state flips the instant you click,
      // regardless of whether this tab still needs a network fetch.
      page.dataset.activeTab = tabEl.dataset.tab;

      if (panel && panel.dataset.loaded === 'true') return; // already loaded — let main-collection.js handle it normally

      e.preventDefault();
      e.stopImmediatePropagation(); // don't let main-collection.js toggle an empty panel
      fetchType(type, tabEl);
    }, true); // capture phase — runs before main-collection.js's listener
  });

  // The Articles-tab filter placeholder's "Switch to Products" link
  // carries data-tab="products" too, so it rides the same handler.
})();