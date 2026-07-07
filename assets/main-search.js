/**
 * assets/main-search.js
 * Behavior for sections/main-search.liquid
 *
 * Scope: search-page-only concerns â€” right now just the result-type
 * tabs (All / Products / Pages / Articles) and keeping their state in
 * the URL. Two things this file deliberately does NOT do:
 *   - Per-card behavior (wishlist, quickview, compare, ATC): that's
 *     product-card.js, loaded globally via theme.liquid, already
 *     running against the cards this section renders.
 *   - Sorting: snippets/collection-filter.liquid (shared with the
 *     collection page) owns the sort <select> and its own JS
 *     (collection-filter.js), also loaded by this section.
 *
 * Guard flag follows the same naming convention as product-card.js's
 * window.__productCardLoaded.
 */

(function () {
  if (window.__mainSearchLoaded) return;
  window.__mainSearchLoaded = true;

  function initMainSearch(root) {
    var tabsWrap = root.querySelector('[data-search-tabs]');

    if (tabsWrap) {
      tabsWrap.addEventListener('click', function (event) {
        var tab = event.target.closest('[data-search-tab]');
        if (!tab || !tabsWrap.contains(tab)) return;

        var type = tab.getAttribute('data-search-tab');
        setActiveTab(tabsWrap, tab);
        showPanel(root, type);
        syncUrl(root, { type: type === 'all' ? null : type });
      });
    }
  }

  function setActiveTab(tabsWrap, activeTab) {
    var tabs = tabsWrap.querySelectorAll('[data-search-tab]');
    for (var i = 0; i < tabs.length; i++) {
      var isActive = tabs[i] === activeTab;
      tabs[i].classList.toggle('main-search__tab--active', isActive);
      tabs[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
  }

  function showPanel(root, type) {
    var panels = root.querySelectorAll('[data-search-panel]');
    for (var i = 0; i < panels.length; i++) {
      var panelType = panels[i].getAttribute('data-search-panel');
      var shouldShow = type === 'all' || panelType === type;
      panels[i].hidden = !shouldShow;
    }
  }

  // Reloads the page with updated query params so full-text search
  // and sorting stay server-driven (matches how the section's liquid
  // reads search.types / search.sort_by). Passing a null value removes
  // the param instead of setting it to the string "null".
  function syncUrl(root, params) {
    var url = new URL(window.location.href);

    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (value === null || value === undefined || value === '') {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });

    // Changing type or sort should reset pagination.
    url.searchParams.delete('page');

    window.location.href = url.toString();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('[data-main-search]');
    if (root) initMainSearch(root);
  });
})();