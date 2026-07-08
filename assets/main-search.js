(function () {
  'use strict';

  var root = document.querySelector('[data-search-results]');
  if (!root) return;

  var searchUrl = root.getAttribute('data-search-url');
  var searchTerm = root.getAttribute('data-search-term');
  var sectionId = root.getAttribute('data-section-id');

  var toolbar = root.querySelector('[data-search-toolbar]');
  var tabTriggers = toolbar ? Array.prototype.slice.call(toolbar.querySelectorAll('[data-tab-trigger]')) : [];
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-tab-panel]'));

  // ---------------------------------------------------------------------
  // Tab switching
  // ---------------------------------------------------------------------

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

  var userSelectedTab = false;

  tabTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      userSelectedTab = true;
      activateTab(trigger.getAttribute('data-tab-trigger'), true);
    });
  });

  function pickInitialTab() {
    var params = new URLSearchParams(window.location.search);
    var typeParam = (params.get('type') || '').split(',').map(function (t) { return t.trim(); });
    var wantsProducts = typeParam.indexOf('product') !== -1;
    var wantsArticles = typeParam.indexOf('article') !== -1;

    if (wantsProducts && !wantsArticles) return 'products';
    if (wantsArticles && !wantsProducts) return 'articles';
    return null; // ambiguous — decide once real counts are in from fetchPanel
  }

  var initialTab = pickInitialTab();
  if (initialTab) activateTab(initialTab, false);

  // ---------------------------------------------------------------------
  // Independent per-type fetching via the Section Rendering API.
  // Each tab gets its own accurate result count and its own pagination,
  // instead of sharing one paginated set where a large product catalog
  // can crowd articles off page 1 (or vice versa).
  // ---------------------------------------------------------------------

  var currentPage = { product: 1, article: 1 };
  var panelKeyFor = { product: 'products', article: 'articles' };

  function fetchPanel(type, page) {
    if (!searchUrl || !sectionId) return Promise.resolve();

    var url = new URL(searchUrl, window.location.origin);
    url.searchParams.set('q', searchTerm || '');
    url.searchParams.set('type', type);
    url.searchParams.set('page', page || 1);
    url.searchParams.set('section_id', sectionId);

    return fetch(url.toString())
      .then(function (response) {
        if (!response.ok) throw new Error('Search fetch failed: ' + response.status);
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var panelKey = panelKeyFor[type];

        var freshPanel = doc.querySelector('[data-tab-panel="' + panelKey + '"]');
        var livePanel = root.querySelector('[data-tab-panel="' + panelKey + '"]');
        if (!freshPanel || !livePanel) return;

        var freshBody = freshPanel.querySelector('[data-panel-body]');
        var liveBody = livePanel.querySelector('[data-panel-body]');
        if (freshBody && liveBody) {
          liveBody.innerHTML = freshBody.innerHTML;
        }

        var freshCount = doc.querySelector('[data-tab-count="' + panelKey + '"]');
        var liveCount = root.querySelector('[data-tab-count="' + panelKey + '"]');
        if (freshCount && liveCount) {
          liveCount.textContent = freshCount.textContent;
        }

        currentPage[type] = page || 1;

        return { type: type, hasResults: !!freshBody && !!freshBody.querySelector('.search-feed__grid') };
      })
      .catch(function (err) {
        // Leave the initial server-rendered content in place on failure.
        console.error('[main-search] failed to load ' + type + ' results:', err);
      });
  }

  // Load both tabs' authoritative results on page load.
  Promise.all([fetchPanel('product', 1), fetchPanel('article', 1)]).then(function (results) {
    if (initialTab) return; // URL already told us which tab to show
    if (userSelectedTab) return; // the person already clicked a tab — don't override them

    var productResult = results[0];
    var articleResult = results[1];
    var productsHaveResults = productResult && productResult.hasResults;
    var articlesHaveResults = articleResult && articleResult.hasResults;

    if (!productsHaveResults && articlesHaveResults) {
      activateTab('articles', false);
    } else {
      activateTab('products', false);
    }
  });

  // Intercept pagination clicks inside either panel and re-fetch just that
  // panel instead of doing a full page navigation.
  root.addEventListener('click', function (event) {
    var link = event.target.closest('[data-panel-pagination] a');
    if (!link) return;

    var panel = link.closest('[data-tab-panel]');
    var type = panel && panel.getAttribute('data-type');
    if (!type) return;

    var linkUrl = new URL(link.href, window.location.origin);
    var page = parseInt(linkUrl.searchParams.get('page'), 10) || 1;

    event.preventDefault();
    fetchPanel(type, page);

    var panelBody = panel.querySelector('[data-panel-body]');
    if (panelBody && panelBody.scrollIntoView) {
      panelBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ---------------------------------------------------------------------
  // Mobile filter drawer
  // ---------------------------------------------------------------------

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

  // ---------------------------------------------------------------------
  // Filter auto-submit
  // ---------------------------------------------------------------------

  var filterForm = root.querySelector('[data-search-filter-form]');
  if (filterForm) {
    var filterInputs = filterForm.querySelectorAll('[data-search-filter-input]');
    filterInputs.forEach(function (input) {
      input.addEventListener('change', function () {
        filterForm.requestSubmit ? filterForm.requestSubmit() : filterForm.submit();
      });
    });
  }

  // ---------------------------------------------------------------------
  // Sort-by select
  // ---------------------------------------------------------------------

  var sortSelect = root.querySelector('[data-search-sort-select]');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sort_by', sortSelect.value);
      window.location.href = url.toString();
    });
  }
})();