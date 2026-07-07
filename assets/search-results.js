/* assets/search-results.js
   Owned by snippets/search-results.liquid.

   This file's original behavior — arrow-key navigation between the
   Products/Articles tabs, per the WAI-ARIA "Tabs" pattern — moved to
   search-toolbar.js once the tab switcher itself became rendered
   exclusively by search-toolbar.liquid. It was kept as an empty stub
   in case a future behavior needed a home here.

   That future behavior is this: product-results.js and
   article-results.js (formerly owned by snippets/product-results.
   liquid and snippets/article-results.liquid) are merged in below,
   since both snippets are now inlined into search-results.liquid.
   Each keeps its own IIFE, load guard, and storage key prefix so the
   two scroll-restore behaviors stay fully independent — grid lookups
   simply no-op (via the early `if (!grid) return`) on whichever panel
   isn't active/rendered for the current search type.
*/

/* ------------------------------------------------------------------
   snippet: product-results (formerly assets/product-results.js)

   Remembers scroll position within the product grid so that using
   the browser back button (after opening a product or quick view)
   restores the shopper to where they were, instead of dropping them
   back at the top of the results.
   ------------------------------------------------------------------ */
(function () {
  if (window.__productResultsLoaded) return;
  window.__productResultsLoaded = true;

  var storageKey = 'productResultsScroll:' + window.location.pathname + window.location.search;
  var grid = document.getElementById('search-results-grid');
  if (!grid) return;

  grid.addEventListener('click', function (event) {
    if (event.target.closest('a, [data-atc-btn], [data-quickview-btn]')) {
      sessionStorage.setItem(storageKey, String(window.scrollY));
    }
  });

  window.addEventListener('pageshow', function () {
    var savedY = sessionStorage.getItem(storageKey);
    if (savedY !== null) {
      window.scrollTo(0, parseInt(savedY, 10));
      sessionStorage.removeItem(storageKey);
    }
  });
})();
/* /snippet: product-results */

/* ------------------------------------------------------------------
   snippet: article-results (formerly assets/article-results.js)

   Same scroll-restore behavior as above, scoped to the article grid,
   so returning from an article via the back button lands the
   shopper back where they were.
   ------------------------------------------------------------------ */
(function () {
  if (window.__articleResultsLoaded) return;
  window.__articleResultsLoaded = true;

  var storageKey = 'articleResultsScroll:' + window.location.pathname + window.location.search;
  var grid = document.getElementById('search-articles-grid');
  if (!grid) return;

  grid.addEventListener('click', function (event) {
    if (event.target.closest('a')) {
      sessionStorage.setItem(storageKey, String(window.scrollY));
    }
  });

  window.addEventListener('pageshow', function () {
    var savedY = sessionStorage.getItem(storageKey);
    if (savedY !== null) {
      window.scrollTo(0, parseInt(savedY, 10));
      sessionStorage.removeItem(storageKey);
    }
  });
})();
/* /snippet: article-results */