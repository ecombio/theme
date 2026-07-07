/* assets/main-search.js
   Handles: tab switching (product <-> article), mobile sort sheet,
   pagination clicks, and popstate — all via the Section Rendering API
   so both the Products and Articles panels can be populated without a
   full page reload.

   WHY THIS EXISTS:
   search.results is scoped to a single `type` per request (Shopify
   limitation) — you cannot get products AND articles back from one
   search request. So instead of two real <a> links causing two full
   page loads, we intercept tab clicks, fetch the *other* type's markup
   via ?section_id=..., and swap it into the currently-empty/hidden
   panel. Each type is cached after first fetch so re-clicking a tab
   is instant and doesn't re-hit the network.
*/

(function () {
  'use strict';

  var root = document.getElementById('main-search');
  if (!root) return;

  var page = document.querySelector('[data-search-page]');
  var sectionId = root.dataset.sectionId;
  var feed = document.getElementById('search-feed');
  var tabs = root.querySelectorAll('.tab-switcher__tab');
  var panels = root.querySelectorAll('[data-panel]');

  // Cache of already-fetched/populated types, so we don't re-fetch.
  var populated = {};
  panels.forEach(function (p) {
    var type = p.dataset.panel;
    // A panel counts as already-populated if it has a grid with
    // children, or an empty-state message, i.e. it isn't just blank.
    if (p.querySelector('.search-results-grid, .article-feed, .search-empty')) {
      populated[type] = true;
    }
  });

  var activeType = page ? page.dataset.activeType : 'product';
  var requestToken = 0;

  function panelFor(type) {
    return root.querySelector('[data-panel="' + type + '"]');
  }

  function tabFor(type) {
    return root.querySelector('[data-type="' + type + '"]');
  }

  function setActiveUI(type) {
    tabs.forEach(function (t) {
      var on = t.dataset.type === type;
      t.classList.toggle('tab-switcher__tab--active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
    });
    panels.forEach(function (p) {
      if (p.dataset.panel === type) {
        p.removeAttribute('hidden');
      } else {
        p.setAttribute('hidden', '');
      }
    });
    if (page) page.dataset.activeType = type;
    activeType = type;

    // Sort control only makes sense for products
    var sortWrap = root.querySelector('.search-toolbar__sort');
    if (sortWrap) sortWrap.style.display = type === 'product' ? '' : 'none';
  }

  function buildFetchUrl(type) {
    var url = new URL(window.location.href);
    url.searchParams.set('type', type);
    // A tab switch should reset pagination for that type
    url.searchParams.delete('page');
    return url;
  }

  function fetchPanel(type, callback) {
    if (!sectionId) {
      // No section id available — fall back to full navigation.
      window.location.href = buildFetchUrl(type).toString();
      return;
    }

    var url = buildFetchUrl(type);
    var fetchUrl = new URL(url.toString());
    fetchUrl.searchParams.set('section_id', sectionId);

    var thisRequest = ++requestToken;
    var panel = panelFor(type);
    if (panel) panel.setAttribute('aria-busy', 'true');

    fetch(fetchUrl.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('Search fetch failed');
        return res.text();
      })
      .then(function (html) {
        if (thisRequest !== requestToken) return; // stale response

        var doc = new DOMParser().parseFromString(html, 'text/html');
        var newPanel = doc.querySelector('[data-panel="' + type + '"]');
        var currentPanel = panelFor(type);

        if (newPanel && currentPanel) {
          var wasHidden = currentPanel.hasAttribute('hidden');
          currentPanel.replaceWith(newPanel);
          if (wasHidden) newPanel.setAttribute('hidden', '');
          panels = root.querySelectorAll('[data-panel]'); // refresh refs
        }

        populated[type] = true;
        if (callback) callback();
      })
      .catch(function () {
        // Network error — fall back to a real navigation rather than
        // leaving the tab in a stuck/loading state.
        window.location.href = url.toString();
      });
  }

  function activateTab(type, push) {
    if (type === activeType) return;

    setActiveUI(type);

    if (push) {
      var url = buildFetchUrl(type);
      history.pushState({ type: type }, '', url.toString());
    }

    if (!populated[type]) {
      fetchPanel(type);
    }
  }

  /* ── Tab clicks (intercept the <a> links) ─────────────────── */
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function (e) {
      e.preventDefault();
      activateTab(tab.dataset.type, true);
    });

    tab.addEventListener('keydown', function (e) {
      var next;
      if (e.key === 'ArrowRight') next = tabs[i + 1] || tabs[0];
      if (e.key === 'ArrowLeft') next = tabs[i - 1] || tabs[tabs.length - 1];
      if (next) {
        next.focus();
        next.click();
      }
    });
  });

  /* ── Pagination + sort links inside a panel also go through
     the same fetch-and-swap path, so switching tabs afterwards
     still works off cached, up-to-date markup. ─────────────── */
  if (feed) {
    feed.addEventListener('click', function (e) {
      var link = e.target.closest('.pagination__link[href]');
      if (!link) return;
      e.preventDefault();

      var targetUrl = new URL(link.href);
      var type = targetUrl.searchParams.get('type') || activeType;

      if (!sectionId) {
        window.location.href = targetUrl.toString();
        return;
      }

      var fetchUrl = new URL(targetUrl.toString());
      fetchUrl.searchParams.set('section_id', sectionId);

      fetch(fetchUrl.toString())
        .then(function (res) { return res.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var newPanel = doc.querySelector('[data-panel="' + type + '"]');
          var currentPanel = panelFor(type);
          if (newPanel && currentPanel) {
            currentPanel.replaceWith(newPanel);
            panels = root.querySelectorAll('[data-panel]');
          }
          history.pushState({ type: type }, '', targetUrl.toString());
          window.scrollTo({ top: feed.offsetTop - 24, behavior: 'smooth' });
        })
        .catch(function () {
          window.location.href = targetUrl.toString();
        });
    });
  }

  /* ── Sort select (desktop) ─────────────────────────────────── */
  var sortSelect = root.querySelector('[data-sort]');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      var url = buildFetchUrl('product');
      url.searchParams.set('sort_by', sortSelect.value);
      window.location.href = url.toString();
    });
  }

  /* ── Mobile sort sheet (built lazily, mirrors #SortBy) ────── */
  var mobileSortBtn = root.querySelector('[data-mobile-sort-toggle]');
  var backdrop = root.querySelector('.search-mobile-backdrop');

  if (mobileSortBtn) {
    var sortSheet = null;

    function buildSortSheet() {
      var sheet = document.createElement('div');
      sheet.className = 'mobile-sort-sheet';
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      sheet.setAttribute('aria-label', 'Sort options');

      var inner = '<div class="mobile-sort-sheet__inner">';
      inner += '<div class="mobile-sort-sheet__handle"></div>';
      inner += '<p class="mobile-sort-sheet__heading">Sort by</p>';
      inner += '<ul class="mobile-sort-sheet__list">';

      var desktopSort = document.getElementById('SortBy');
      if (desktopSort) {
        Array.from(desktopSort.options).forEach(function (opt) {
          var active = opt.selected ? ' mobile-sort-sheet__option--active' : '';
          inner +=
            '<li><button class="mobile-sort-sheet__option' + active + '" type="button" ' +
            'data-sort-value="' + opt.value + '">' + opt.text + '</button></li>';
        });
      }

      inner += '</ul></div>';
      sheet.innerHTML = inner;

      sheet.querySelectorAll('[data-sort-value]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var url = buildFetchUrl('product');
          url.searchParams.set('sort_by', btn.dataset.sortValue);
          window.location.href = url.toString();
        });
      });

      document.body.appendChild(sheet);
      return sheet;
    }

    function openSortSheet() {
      if (!sortSheet) sortSheet = buildSortSheet();
      sortSheet.getBoundingClientRect();
      sortSheet.classList.add('is-open');
      mobileSortBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      if (backdrop) {
        backdrop.classList.add('is-visible');
        backdrop._onClose = closeSortSheet;
      }
    }

    function closeSortSheet() {
      if (!sortSheet) return;
      sortSheet.classList.remove('is-open');
      mobileSortBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (backdrop) backdrop.classList.remove('is-visible');
    }

    mobileSortBtn.addEventListener('click', function () {
      sortSheet && sortSheet.classList.contains('is-open')
        ? closeSortSheet()
        : openSortSheet();
    });

    if (backdrop) {
      backdrop.addEventListener('click', function () {
        if (backdrop._onClose) backdrop._onClose();
      });
    }
  }

  /* ── Back/forward support ─────────────────────────────────── */
  window.addEventListener('popstate', function (e) {
    var type = (e.state && e.state.type)
      || new URL(window.location.href).searchParams.get('type')
      || 'product';
    setActiveUI(type);
    if (!populated[type]) fetchPanel(type);
  });

  /* ══════════════════════════════════════════════════════════
     FILTER SIDEBAR
     Products-only. Drawer open/close (mobile), backdrop
     coordination, and live AJAX filtering via the Section
     Rendering API — mirrors the collection page's filter pattern,
     but keeps `type=product` and `q=` pinned in every request.
  ══════════════════════════════════════════════════════════ */
  var filterPanel   = document.getElementById('search-filter');
  var filterToggles = root.querySelectorAll('[data-filter-toggle]');
  var searchBody    = root.querySelector('[data-search-body]');

  if (filterPanel) {

    function openFilter() {
      filterPanel.removeAttribute('hidden');
      requestAnimationFrame(function () {
        filterPanel.classList.add('is-open');
      });
      filterToggles.forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
      document.body.style.overflow = 'hidden';
      if (backdrop) {
        backdrop.classList.add('is-visible');
        backdrop._onClose = closeFilter;
      }
    }

    function closeFilter() {
      filterPanel.classList.remove('is-open');
      filterToggles.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
      document.body.style.overflow = '';
      filterPanel.addEventListener('transitionend', function handler() {
        if (!filterPanel.classList.contains('is-open')) {
          filterPanel.setAttribute('hidden', '');
        }
        filterPanel.removeEventListener('transitionend', handler);
      });
      if (backdrop) backdrop.classList.remove('is-visible');
    }

    filterToggles.forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        if (toggle.disabled) return;
        var isMobile = window.innerWidth <= 768;
        if (isMobile) {
          filterPanel.classList.contains('is-open') ? closeFilter() : openFilter();
        } else {
          var isOpen = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
          if (isOpen) {
            filterPanel.setAttribute('hidden', '');
            if (searchBody) searchBody.classList.add('search-body--filters-hidden');
          } else {
            filterPanel.removeAttribute('hidden');
            if (searchBody) searchBody.classList.remove('search-body--filters-hidden');
          }
        }
      });
    });

    var closeBtn = filterPanel.querySelector('[data-filter-close]');
    if (closeBtn) closeBtn.addEventListener('click', closeFilter);

    /* ── Live filtering ─────────────────────────────────────── */
    var filterForm = document.getElementById('SearchFilterForm');
    var filterRequestToken = 0;

    function buildFilterUrl() {
      var currentUrl = new URL(window.location.href);
      var existingSortBy = currentUrl.searchParams.get('sort_by');

      var url = new URL(window.location.href);
      url.search = '';

      new FormData(filterForm).forEach(function (val, key) {
        // Skip blank values — an untouched price field submitting as
        // an empty string can zero out the range instead of leaving
        // it open.
        if (val === '') return;
        url.searchParams.append(key, val);
      });

      if (existingSortBy && !url.searchParams.has('sort_by')) {
        url.searchParams.set('sort_by', existingSortBy);
      }

      url.searchParams.set('type', 'product');
      return url;
    }

    function bindFilterFieldListeners() {
      if (!filterForm) return;
      filterForm.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
        input.addEventListener('change', function () { applyFiltersLive(true); });
      });
      filterForm.querySelectorAll('input[type="number"]').forEach(function (input) {
        input.addEventListener('change', function () { applyFiltersLive(true); });
      });
    }

    function applyFiltersLive(pushHistory) {
      if (!filterForm) return;

      var displayUrl = buildFilterUrl();

      if (!sectionId) {
        window.location.href = displayUrl.toString();
        return;
      }

      var fetchUrl = new URL(displayUrl.toString());
      fetchUrl.searchParams.set('section_id', sectionId);

      var thisRequest = ++filterRequestToken;
      var grid = root.querySelector('.search-results-grid');
      filterForm.setAttribute('aria-busy', 'true');
      if (grid) grid.style.opacity = '0.5';

      fetch(fetchUrl.toString())
        .then(function (res) {
          if (!res.ok) throw new Error('Filter request failed');
          return res.text();
        })
        .then(function (html) {
          if (thisRequest !== filterRequestToken) return; // stale response

          var doc = new DOMParser().parseFromString(html, 'text/html');

          var newPanel = doc.querySelector('[data-panel="product"]');
          var currentPanel = panelFor('product');
          if (newPanel && currentPanel) {
            currentPanel.replaceWith(newPanel);
            panels = root.querySelectorAll('[data-panel]');
          }

          var newFilterForm = doc.getElementById('SearchFilterForm');
          if (newFilterForm) {
            filterForm.innerHTML = newFilterForm.innerHTML;
            bindFilterFieldListeners();
          }

          populated.product = true;

          if (pushHistory) {
            history.pushState({ type: 'product' }, '', displayUrl.toString());
          }

          filterForm.removeAttribute('aria-busy');
        })
        .catch(function () {
          window.location.href = displayUrl.toString();
        });
    }

    bindFilterFieldListeners();

    if (filterForm) {
      filterForm.addEventListener('submit', function (e) {
        e.preventDefault();
        applyFiltersLive(true);
      });
    }

    window.addEventListener('popstate', function () {
      if (activeType === 'product') applyFiltersLive(false);
    });
  }

})();