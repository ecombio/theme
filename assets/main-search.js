/* assets/main-search.js
   Owned by sections/main-search.liquid.

   This file was previously retired (its only behavior, the sort
   <select>, moved to search-toolbar.js) but is now revived as the
   home for the filter-drawer and live-filtering logic that used to
   live in assets/search-filter.js (snippets/search-filter.liquid was
   inlined into sections/main-search.liquid, and this merge does the
   same for its script — one fewer file to load, one fewer script tag
   in the section markup).

   Two responsibilities:

   1. Opening/closing the filter drawer: the toggle buttons live in
      the section toolbar/mobile bar, the backdrop element lives in
      the section markup too — this script owns all of that behavior
      since it's all "does the filter drawer show or not."

   2. Live filtering (AJAX via the Section Rendering API): checking a
      filter or editing a price field re-fetches just the main-search
      section's HTML with the new query params and swaps in the
      updated product grid, filter form, pagination, and result
      count — no full page reload. Ported from main-collection's
      collection-filter.js, which does the same thing for the
      collection page's product-filter form; see that file for the
      original. Differences here:
        - This form already carries `q` and `type` as hidden inputs
          (collection's form didn't need either, since collection.url
          is already scoped to one collection), so FormData picks
          them up for free — no separate "preserve q/type" step.
        - Filters only ever render on the Products tab (Shopify has
          no faceted search for articles), so this bails out early if
          the filter <form> isn't present at all — no live-filtering
          setup needed on the Articles tab.
        - Tab switching itself is NOT live here (unlike collection's
          tab switching, which collection-feed.js does intercept) —
          search's tabs are deliberately plain links to
          ?type=product|article, per the note in search-results.js.
          This script only makes the FILTER FORM's fields live; it
          never touches tab navigation.
        - Also swaps the hero's result count ("N results for
          ‘query’") since that changes as filters narrow the results,
          which collection's hero text doesn't have an equivalent of.
*/
(function () {
  if (window.__mainSearchLoaded) return;
  window.__mainSearchLoaded = true;

  var filterAside = document.getElementById('search-filter');
  if (!filterAside) return;

  var backdrop = document.querySelector('.search-mobile-backdrop');
  var filterToggles = document.querySelectorAll('[data-filter-toggle]');
  var filterClose = document.querySelector('[data-filter-close]');

  function setToggleState(expanded) {
    filterToggles.forEach(function (btn) {
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function openFilters() {
    filterAside.hidden = false;
    setToggleState(true);
    if (backdrop) backdrop.classList.add('is-visible');
  }

  function closeFilters() {
    filterAside.hidden = true;
    setToggleState(false);
    if (backdrop) backdrop.classList.remove('is-visible');
  }

  filterToggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (filterAside.hidden) {
        openFilters();
      } else {
        closeFilters();
      }
    });
  });

  if (filterClose) filterClose.addEventListener('click', closeFilters);
  if (backdrop) backdrop.addEventListener('click', closeFilters);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeFilters();
  });

  /* ── Live filtering (AJAX via Section Rendering API) ──────────
     Checking/unchecking a filter (or changing a price field)
     re-fetches just this section's HTML with the new query params
     and swaps in the updated product grid + filter form + pagination
     + result count, with no full page reload. Unchecking a filter is
     just another change event, so it live-reverts the same way.

     Falls back to a normal full-page navigation if fetch fails, if
     there's no section id to fetch with, or if JS never runs at all
     (the form's method="get" + inputs' name attributes still work as
     plain query params). ─────────────────────────────────────────── */
  var filterForm = document.getElementById('SearchFilterForm');
  if (!filterForm) return; // Articles tab (or filters disabled) — nothing further to wire up

  var sectionRoot = document.getElementById('main-search');
  var sectionId = sectionRoot ? sectionRoot.dataset.sectionId : null;
  var filterRequestToken = 0;

  function buildFilterUrl() {
    // Preserve sort_by from the CURRENT url before rebuilding the
    // query string from the filter form, so applying a filter never
    // resets sort back to default. (q and type don't need the same
    // treatment — they're already hidden inputs inside the form.)
    var currentUrl = new URL(window.location.href);
    var existingSortBy = currentUrl.searchParams.get('sort_by');

    var url = new URL(window.location.href);
    url.search = '';

    new FormData(filterForm).forEach(function (val, key) {
      // Skip blank values (e.g. an untouched price field) — an empty
      // filter.v.price.gte/lte param can cause the storefront to
      // treat the range as effectively zero, filtering out products
      // that should still match.
      if (val === '') return;
      url.searchParams.append(key, val);
    });

    if (existingSortBy && !url.searchParams.has('sort_by')) {
      url.searchParams.set('sort_by', existingSortBy);
    }

    return url;
  }

  function bindFilterFieldListeners() {
    filterForm.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
      input.addEventListener('change', function () {
        applyFiltersLive(true);
      });
    });
    filterForm.querySelectorAll('input[type="number"]').forEach(function (input) {
      input.addEventListener('change', function () {
        applyFiltersLive(true);
      });
    });
  }

  function applyFiltersLive(pushHistory) {
    var displayUrl = buildFilterUrl();

    if (!sectionId) {
      // No section id available — fall back to a full-page reload
      // rather than silently doing nothing.
      window.location.href = displayUrl.toString();
      return;
    }

    var fetchUrl = new URL(displayUrl.toString());
    fetchUrl.searchParams.set('section_id', sectionId);

    var thisRequest = ++filterRequestToken;
    var grid = document.getElementById('search-results-grid');
    filterForm.setAttribute('aria-busy', 'true');
    if (grid) grid.style.opacity = '0.5';

    fetch(fetchUrl.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('Filter request failed');
        return res.text();
      })
      .then(function (html) {
        // Another change happened while this request was in flight —
        // drop this (now-stale) response instead of overwriting newer
        // results with older ones.
        if (thisRequest !== filterRequestToken) return;

        var doc = new DOMParser().parseFromString(html, 'text/html');

        // Swap the grid's CONTENTS in place rather than replacing the
        // grid node itself. product-results.js (and any product-card
        // click handlers) bind their listeners directly to this node
        // once, on page load — replaceWith() would drop in a fresh
        // node those listeners were never attached to, silently
        // killing scroll-restore, add-to-cart, quick view, etc. on
        // every card the next time a filter is applied.
        var newGrid = doc.getElementById('search-results-grid');
        var currentGrid = document.getElementById('search-results-grid');
        if (newGrid && currentGrid) {
          currentGrid.innerHTML = newGrid.innerHTML;
          var newStyle = newGrid.getAttribute('style');
          if (newStyle) currentGrid.setAttribute('style', newStyle);
        }

        var newFilterForm = doc.getElementById('SearchFilterForm');
        if (newFilterForm) {
          // Swap in the refreshed filter markup (updated counts,
          // active pills, disabled options) and rebind listeners,
          // since the old input elements were just replaced.
          filterForm.innerHTML = newFilterForm.innerHTML;
          bindFilterFieldListeners();
        }

        var productsPanel = document.getElementById('panel-products');
        var newPagination = doc.querySelector('#panel-products .pagination');
        var currentPagination = productsPanel ? productsPanel.querySelector('.pagination') : null;
        if (currentPagination) currentPagination.remove();
        if (newPagination && productsPanel) productsPanel.appendChild(newPagination);

        var newCount = doc.getElementById('search-result-count');
        var currentCount = document.getElementById('search-result-count');
        if (newCount && currentCount) currentCount.replaceWith(newCount);

        if (pushHistory) {
          history.pushState({}, '', displayUrl.toString());
        }

        filterForm.removeAttribute('aria-busy');
      })
      .catch(function () {
        // Network error, bad response, etc. — don't leave the user
        // stuck with a half-applied filter and a dimmed grid.
        window.location.href = displayUrl.toString();
      });
  }

  bindFilterFieldListeners();

  // Keep the Apply button / Enter-key submit working (e.g. after
  // typing in a price field and pressing Enter), routed through the
  // same live path instead of a full navigation.
  filterForm.addEventListener('submit', function (e) {
    e.preventDefault();
    applyFiltersLive(true);
  });

  // Back/forward support. Safe to always re-apply on popstate: this
  // listener only ever gets attached when the Products tab's filter
  // form exists on THIS page load, and pushState only ever fires
  // while on that tab — so a popstate landing back on the Articles
  // tab means the browser did a full navigation instead (a different
  // document, so this listener isn't even alive to hear it).
  window.addEventListener('popstate', function () {
    applyFiltersLive(false);
  });
})();