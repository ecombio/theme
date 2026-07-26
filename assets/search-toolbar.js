/* assets/search-toolbar.js
   Owned by snippets/search-toolbar.liquid.

   Handles the sort <select> and the Products/Articles tab switcher,
   plus arrow-key navigation between the two tabs per the WAI-ARIA
   "Tabs" pattern (Left/Right/Home/End move focus + roving tabindex).
   The tab-nav logic used to live in search-results.js, back when
   search-results.liquid rendered its own (duplicate) copy of the tab
   switcher; it's moved here now that the toolbar is the only snippet
   that renders that markup.

   NAVIGATION MODE is controlled per-section by
   section.settings.ajax_navigation (schema: sections/main-search.liquid),
   surfaced to this script via [data-ajax-navigation] on #search-toolbar:

     - ajax_navigation OFF (default): tabs and sort are real links /
       a real redirect. Every switch is a full page load. This is the
       original, simplest behavior -- no client-side state to keep in
       sync, works with JS disabled.

     - ajax_navigation ON: tab clicks and sort changes are intercepted,
       fetched, and swapped in without a full reload. Falls back to a
       real navigation if the fetch fails, the response is malformed,
       or JS never loads (tabs are still real <a href> elements either
       way, so nothing breaks without this script).

   UNVERIFIED / KNOWN GAP: the #main-search element being swapped in
   contains a <script src="main-search.js" defer> tag at the bottom of
   sections/main-search.liquid. Browsers do NOT execute <script> tags
   injected via replaceWith/innerHTML, so if main-search.js (or
   search-results.js / article-results.js / search-filter.js) does any
   per-load setup, that setup will silently stop firing after the
   first AJAX swap. This has not been checked against main-search.js
   yet -- do not flip ajax_navigation to default:true in the schema
   until that's confirmed safe.

   NOT YET AJAX'd: filter pills and "Clear all" inside the toolbar
   (.search-filter__pill) are untouched by this file and will still
   force a full page reload even with ajax_navigation on. Filters
   live in search-filter.liquid / search-filter.js and would need
   their own pass -- scoped out of this change on purpose.

   Filter drawer open/close lives in search-filter.js; grid
   scroll-restore lives in product-results.js / article-results.js.
*/
(function () {
  if (window.__searchToolbarLoaded) return;
  window.__searchToolbarLoaded = true;

  var toolbar = document.getElementById('search-toolbar');
  var ajaxEnabled = !!toolbar && toolbar.getAttribute('data-ajax-navigation') === 'true';

  // ---------------------------------------------------------------
  // Sort <select>
  // ---------------------------------------------------------------
  var sortSelect = document.querySelector('[data-sort]');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sort_by', sortSelect.value);
      if (ajaxEnabled) {
        navigateAjax(url);
      } else {
        window.location.href = url.toString();
      }
    });
  }

  // ---------------------------------------------------------------
  // Tab clicks (AJAX mode only -- in default mode these are left
  // completely alone as real <a href> navigations)
  // ---------------------------------------------------------------
  if (ajaxEnabled) {
    document.addEventListener('click', function (event) {
      var tab = event.target.closest('.tab-switcher__tab');
      if (!tab) return;
      // Let modified clicks (open in new tab, etc.) behave normally.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

      event.preventDefault();
      navigateAjax(new URL(tab.href));
    });

    // Keep content in sync with the URL bar on back/forward. Without
    // this, AJAX-switching tabs then hitting Back changes the URL but
    // leaves the old content on screen.
    window.addEventListener('popstate', function () {
      navigateAjax(new URL(window.location.href), { pushState: false });
    });
  }

  function navigateAjax(url, options) {
    options = options || {};
    var shouldPushState = options.pushState !== false;

    var current = document.getElementById('main-search');
    if (current) current.setAttribute('aria-busy', 'true');

    var fetchUrl = new URL(url.toString());
    fetchUrl.searchParams.set('section_id', 'main-search');

    fetch(fetchUrl.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('Bad response: ' + res.status);
        return res.text();
      })
      .then(function (html) {
        var next = new DOMParser().parseFromString(html, 'text/html');
        var nextMain = next.getElementById('main-search');
        var currentMain = document.getElementById('main-search');

        if (!nextMain || !currentMain) {
          throw new Error('main-search markup not found in response');
        }

        currentMain.replaceWith(nextMain);

        if (shouldPushState) {
          var cleanUrl = new URL(url.toString());
          cleanUrl.searchParams.delete('section_id');
          history.pushState({}, '', cleanUrl.toString());
        }

        // __searchToolbarLoaded guards this whole IIFE from
        // re-running, so listeners above (all delegated on
        // document/window) keep working against the new DOM without
        // needing to re-attach anything here.
      })
      .catch(function () {
        // Fail safe to a real navigation rather than leaving the
        // page in a stuck/half-updated state.
        window.location.href = url.toString();
      });
  }

  // ---------------------------------------------------------------
  // Roving-tabindex keyboard navigation between tabs (unchanged,
  // applies regardless of ajax_navigation)
  // ---------------------------------------------------------------
  document.addEventListener('keydown', function (event) {
    var tab = event.target.closest('[role="tab"]');
    if (!tab) return;

    var tablist = tab.closest('[role="tablist"]');
    if (!tablist) return;

    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    var index = tabs.indexOf(tab);
    if (index === -1) return;

    var nextIndex = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    tabs.forEach(function (t, i) {
      t.tabIndex = i === nextIndex ? 0 : -1;
    });
    tabs[nextIndex].focus();
  });
})();