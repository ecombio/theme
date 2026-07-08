(function () {
  'use strict';

  var root = document.querySelector('[data-search-results]');
  if (!root) return;

  var toolbar = root.querySelector('[data-search-toolbar]');
  var tabTriggers = toolbar ? Array.prototype.slice.call(toolbar.querySelectorAll('[data-tab-trigger]')) : [];
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-tab-panel]'));

  function activateTab(name, updateUrl) {
    tabTriggers.forEach(function (trigger) {
      var isMatch = trigger.getAttribute('data-tab-trigger') === name;
      trigger.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    panels.forEach(function (panel) {
      var isMatch = panel.getAttribute('data-tab-panel') === name;
      if (isMatch) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    if (updateUrl && window.history && window.history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.set('type', name === 'articles' ? 'article' : 'product');
      window.history.replaceState({}, '', url);
    }
  }

  tabTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      activateTab(trigger.getAttribute('data-tab-trigger'), true);
    });
  });

  // Determine initial active tab from the URL, falling back to whichever
  // panel actually has results, then to "products" as the default.
  (function setInitialTab() {
    var params = new URLSearchParams(window.location.search);
    var typeParam = (params.get('type') || '').split(',').map(function (t) { return t.trim(); });
    var wantsProducts = typeParam.indexOf('product') !== -1;
    var wantsArticles = typeParam.indexOf('article') !== -1;

    var productsPanel = root.querySelector('[data-tab-panel="products"]');
    var articlesPanel = root.querySelector('[data-tab-panel="articles"]');
    var productsHaveResults = !!(productsPanel && productsPanel.querySelector('.search-feed__grid'));
    var articlesHaveResults = !!(articlesPanel && articlesPanel.querySelector('.search-feed__grid'));

    // If the URL explicitly requests only one type, honor it.
    if (wantsProducts && !wantsArticles) {
      activateTab('products', false);
      return;
    }
    if (wantsArticles && !wantsProducts) {
      activateTab('articles', false);
      return;
    }

    // Otherwise (both types requested, or no type param at all): prefer
    // whichever tab actually has content, defaulting to products if both
    // or neither have results.
    if (!productsHaveResults && articlesHaveResults) {
      activateTab('articles', false);
    } else {
      activateTab('products', false);
    }
  })();

  // Mobile filter drawer ----------------------------------------------------

  var filterPanel = root.querySelector('[data-search-filter]');
  var openFilterBtn = root.querySelector('[data-search-filter-open]');
  var closeFilterBtn = root.querySelector('[data-search-filter-close]');
  var overlay = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'search-filter__overlay';
    overlay.setAttribute('data-search-filter-overlay', '');
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeFilterDrawer);
    return overlay;
  }

  function openFilterDrawer() {
    if (!filterPanel) return;
    filterPanel.classList.add('is-open');
    ensureOverlay().classList.add('is-visible');
    document.addEventListener('keydown', handleEscape);
  }

  function closeFilterDrawer() {
    if (!filterPanel) return;
    filterPanel.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-visible');
    document.removeEventListener('keydown', handleEscape);
  }

  function handleEscape(event) {
    if (event.key === 'Escape') closeFilterDrawer();
  }

  if (openFilterBtn) openFilterBtn.addEventListener('click', openFilterDrawer);
  if (closeFilterBtn) closeFilterBtn.addEventListener('click', closeFilterDrawer);

  // Filter auto-submit --------------------------------------------------------

  var filterForm = root.querySelector('[data-search-filter-form]');
  if (filterForm) {
    var filterInputs = filterForm.querySelectorAll('[data-search-filter-input]');
    filterInputs.forEach(function (input) {
      input.addEventListener('change', function () {
        filterForm.requestSubmit ? filterForm.requestSubmit() : filterForm.submit();
      });
    });
  }

  // Sort-by select --------------------------------------------------------------

  var sortSelect = root.querySelector('[data-search-sort-select]');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sort_by', sortSelect.value);
      window.location.href = url.toString();
    });
  }
})();