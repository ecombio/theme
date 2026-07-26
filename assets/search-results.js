/* assets/search-results.js
   Owned by snippets/search-results.liquid, loaded via that snippet's
   own <script> tag (self-contained, same pattern as
   assets/search-results.css / snippets/search-results.liquid's
   stylesheet_tag) rather than by the parent section.

   Re-split out of main-search.js (2026-07) now that main-search.js's
   own header describes this as the third file folded into it —
   scroll-restore for both result grids, formerly its own
   search-results.js, which had itself already absorbed the separate
   product-results.js and article-results.js. The file boundary moves
   with search-results.liquid rather than staying merged into the
   section-level script, mirroring the CSS split done in the same
   pass.

   Responsibility: remembers scroll position within whichever grid
   the shopper clicked into (a product, a quick-view trigger, an
   article), so the browser back button restores them to where they
   were instead of dropping them back at the top of the results. The
   two grids get separate IIFEs, load guards, and sessionStorage key
   prefixes so they stay fully independent — each one's grid lookup
   simply no-ops (via the early `if (!grid) return`) on whichever
   panel isn't active/rendered for the current search type.

   Kept as two independent IIFEs rather than one combined block: each
   bails out early when its own grid isn't on the page (whichever
   panel isn't the active one), and merging them would make one
   grid's behavior incorrectly depend on the other's markup existing.
*/

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