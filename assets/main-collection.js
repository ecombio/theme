/* assets/main-collection.js
   Consolidated script for sections/main-collection.liquid.

   Inlined so far: collection.js, collection-filter.js, collection-feed.js.
   Still separate (not yet inlined here): promo-carousel.js, after-items.js.

   Load-order note: collection.js is placed first because it defines
   window.CollectionBackdrop and window.CollectionBackdrop-consuming code
   (in the collection-filter.js block below) reads it. Previously these
   loaded as separate <script defer> tags in the opposite order
   (collection-filter.js, then collection-feed.js, then collection.js) —
   that only worked because the reference is lazy (inside click handlers,
   not top-level), so by the time a user could click anything, every
   deferred script had already run. Reordering here removes that
   fragility rather than just preserving it. */

/* ============================================================
   Inlined from collection.js — page-level utilities shared
   across collection components: shared backdrop, mobile sort
   sheet, sub-collections carousel.
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     SHARED BACKDROP
     Only one overlay in the DOM; open() stores a callback
     so closeFilter and closeSortSheet don't collide.
  ══════════════════════════════════════════════════════════ */
  var backdrop = document.querySelector('.collection-mobile-backdrop');

  function openBackdrop(onClose) {
    if (!backdrop) return;
    backdrop.classList.add('is-visible');
    backdrop._onClose = onClose;
  }

  function closeBackdrop(caller) {
    if (!backdrop) return;
    backdrop.classList.remove('is-visible');
    if (typeof backdrop._onClose === 'function' && backdrop._onClose !== caller) {
      backdrop._onClose();
    }
    backdrop._onClose = null;
  }

  if (backdrop) {
    backdrop.addEventListener('click', function () {
      closeBackdrop(null);
    });
  }

  // Expose so collection-filter.js can participate
  window.CollectionBackdrop = {
    open:  openBackdrop,
    close: closeBackdrop,
  };

  /* ══════════════════════════════════════════════════════════
     MOBILE SORT SHEET
     Built lazily on first open. Mirrors options from the
     desktop #SortBy select so there's a single source of truth.
  ══════════════════════════════════════════════════════════ */
  var mobileSortBtn = document.querySelector('[data-mobile-sort-toggle]');

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
          var url = new URL(window.location.href);
          url.searchParams.set('sort_by', btn.dataset.sortValue);
          window.location.href = url.toString();
        });
      });

      document.body.appendChild(sheet);
      return sheet;
    }

    function openSortSheet() {
      if (!sortSheet) sortSheet = buildSortSheet();
      sortSheet.getBoundingClientRect(); // force reflow before transition
      sortSheet.classList.add('is-open');
      mobileSortBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      openBackdrop(closeSortSheet);
    }

    function closeSortSheet() {
      if (!sortSheet) return;
      sortSheet.classList.remove('is-open');
      mobileSortBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      closeBackdrop(closeSortSheet);
    }

    mobileSortBtn.addEventListener('click', function () {
      sortSheet && sortSheet.classList.contains('is-open')
        ? closeSortSheet()
        : openSortSheet();
    });
  }

  /* ══════════════════════════════════════════════════════════
     SUB-COLLECTIONS CAROUSEL
     Prev/next buttons scroll the track by ~3 card widths.
  ══════════════════════════════════════════════════════════ */
  document.querySelectorAll('[data-sub-collections]').forEach(function (carousel) {
    var track = carousel.querySelector('[data-sub-collections-track]');
    var prev  = carousel.querySelector('[data-sub-collections-prev]');
    var next  = carousel.querySelector('[data-sub-collections-next]');
    if (!track) return;

    function updateNavState() {
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled =
        track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    }

    function scrollByAmount(dir) {
      var cardWidth = track.firstElementChild
        ? track.firstElementChild.getBoundingClientRect().width
        : 120;
      track.scrollBy({ left: dir * (cardWidth * 3 + 32), behavior: 'smooth' });
    }

    if (prev) prev.addEventListener('click', function () { scrollByAmount(-1); });
    if (next) next.addEventListener('click', function () { scrollByAmount(1); });
    track.addEventListener('scroll', updateNavState);
    updateNavState();
  });

})();

/* ============================================================
   Inlined from collection-filter.js — filter drawer, shared
   backdrop coordination (window.CollectionBackdrop, defined
   above), sort select, filter form submit.
   ============================================================ */

(function () {
  'use strict';

  var filterPanel   = document.getElementById('collection-filter');
  var filterToggles = document.querySelectorAll('[data-filter-toggle]');

  if (!filterPanel) return;

  /* ── Inject mobile close bar ──────────────────────────────── */
  if (!filterPanel.querySelector('.collection-filter__close')) {
    var closeBar = document.createElement('div');
    closeBar.className = 'collection-filter__close';
    closeBar.innerHTML =
      '<span class="collection-filter__close-label">Filters</span>' +
      '<button class="collection-filter__close-btn" type="button" aria-label="Close filters">&times;</button>';
    filterPanel.insertBefore(closeBar, filterPanel.firstChild);
    closeBar.querySelector('.collection-filter__close-btn')
      .addEventListener('click', closeFilter);
  }

  /* ── Open / close ─────────────────────────────────────────── */
  function openFilter() {
    filterPanel.removeAttribute('hidden');
    requestAnimationFrame(function () {
      filterPanel.classList.add('is-open');
    });
    filterToggles.forEach(function (t) {
      t.setAttribute('aria-expanded', 'true');
    });
    document.body.style.overflow = 'hidden';

    if (window.CollectionBackdrop) {
      window.CollectionBackdrop.open(closeFilter);
    }
  }

  function closeFilter() {
    filterPanel.classList.remove('is-open');
    filterToggles.forEach(function (t) {
      t.setAttribute('aria-expanded', 'false');
    });
    document.body.style.overflow = '';

    filterPanel.addEventListener('transitionend', function handler() {
      if (!filterPanel.classList.contains('is-open')) {
        filterPanel.setAttribute('hidden', '');
      }
      filterPanel.removeEventListener('transitionend', handler);
    });

    if (window.CollectionBackdrop) {
      window.CollectionBackdrop.close(closeFilter);
    }
  }

  /* ── Toggle buttons ───────────────────────────────────────── */
  filterToggles.forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      var isMobile = window.innerWidth <= 768;

      if (isMobile) {
        filterPanel.classList.contains('is-open') ? closeFilter() : openFilter();
      } else {
        var isOpen = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');

        if (isOpen) {
          filterPanel.setAttribute('hidden', '');
          document.querySelector('.collection-body')
            && document.querySelector('.collection-body')
               .classList.add('collection-body--filters-hidden');
        } else {
          filterPanel.removeAttribute('hidden');
          document.querySelector('.collection-body')
            && document.querySelector('.collection-body')
               .classList.remove('collection-body--filters-hidden');
        }
      }
    });
  });

  /* ── Sort select (desktop) ────────────────────────────────── */
  var sortSelect = document.querySelector('[data-sort]');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sort_by', sortSelect.value);
      window.location.href = url.toString();
    });
  }

  /* ── Live filtering (AJAX via Section Rendering API) ─────────
     Checking/unchecking a filter (or changing a price field)
     re-fetches just this section's HTML with the new query params
     and swaps in the updated product grid + filter sidebar, with
     no full page reload. Unchecking a filter is just another
     change event, so it live-reverts the same way.

     Falls back to a normal full-page navigation if fetch fails,
     or if JS never runs at all (the form's method="get" + inputs'
     name attributes still work as plain query params). ─────── */
  var filterForm    = document.getElementById('FilterForm');
  var sectionRoot    = document.getElementById('main-collection');
  var sectionId      = sectionRoot ? sectionRoot.dataset.sectionId : null;
  var filterRequestToken = 0;

  function buildFilterUrl() {
    // Preserve sort_by (and any other non-filter params) from the
    // CURRENT url before rebuilding the query string from the filter
    // form, so applying a filter never resets sort back to default.
    var currentUrl = new URL(window.location.href);
    var existingSortBy = currentUrl.searchParams.get('sort_by');

    var url = new URL(window.location.href);
    url.search = '';

    new FormData(filterForm).forEach(function (val, key) {
      // Skip blank values (e.g. an untouched price field with no value
      // set) — submitting an empty filter.v.price.gte/lte param can
      // cause the storefront to treat the range as effectively zero,
      // filtering out products that should still match.
      if (val === '') return;
      url.searchParams.append(key, val);
    });

    if (existingSortBy && !url.searchParams.has('sort_by')) {
      url.searchParams.set('sort_by', existingSortBy);
    }

    // Preserve active tab
    var page = document.querySelector('[data-collection-page]');
    var activeTab = page ? page.dataset.activeTab : 'products';
    url.searchParams.set('tab', activeTab);

    return url;
  }

  function bindFilterFieldListeners() {
    if (!filterForm) return;
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
    if (!filterForm) return;

    var displayUrl = buildFilterUrl();

    if (!sectionId) {
      // No section id available (e.g. template markup out of date) —
      // fall back to the old full-page-reload behavior rather than
      // silently doing nothing.
      window.location.href = displayUrl.toString();
      return;
    }

    var fetchUrl = new URL(displayUrl.toString());
    fetchUrl.searchParams.set('section_id', sectionId);

    var thisRequest = ++filterRequestToken;
    var grid = document.querySelector('.product-feed__grid');
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

        var newProductFeed = doc.getElementById('product-feed');
        var currentProductFeed = document.getElementById('product-feed');
        if (newProductFeed && currentProductFeed) {
          currentProductFeed.replaceWith(newProductFeed);
        }

        var newFilterForm = doc.getElementById('FilterForm');
        if (newFilterForm) {
          // Swap in the refreshed filter markup (updated counts,
          // active pills, disabled options) and rebind listeners,
          // since the old input elements were just replaced.
          filterForm.innerHTML = newFilterForm.innerHTML;
          bindFilterFieldListeners();
        }

        var newPagination = doc.querySelector('.pagination');
        var currentPagination = document.querySelector('.pagination');
        if (currentPagination) currentPagination.remove();
        if (newPagination) {
          document.querySelector('.collection-feed__panel[data-panel="products"]')
            .appendChild(newPagination);
        }

        if (pushHistory) {
          history.pushState({ tab: displayUrl.searchParams.get('tab') }, '', displayUrl.toString());
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

  if (filterForm) {
    // Keep the Apply button / Enter-key submit working (e.g. after
    // typing in a price field and pressing Enter), routed through the
    // same live path instead of a full navigation.
    filterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      applyFiltersLive(true);
    });
  }

  /* ── Back/forward support ─────────────────────────────────── */
  window.addEventListener('popstate', function () {
    applyFiltersLive(false);
  });

  /* ── Expose close for external use (e.g. backdrop click) ─── */
  window.CollectionFilter = { close: closeFilter };

})();

/* ============================================================
   Inlined from collection-feed.js — tab switching and browser
   history (back/forward support) for the collection feed.
   ============================================================ */

(function () {
  'use strict';

  var page = document.querySelector('[data-collection-page]');
  if (!page) return;

  var tabs   = page.querySelectorAll('[data-tab]');
  var panels = page.querySelectorAll('[data-panel]');

  if (!tabs.length || !panels.length) return;

  /* ── Core activate ────────────────────────────────────────── */
  function activateTab(key, push) {
    tabs.forEach(function (t) {
      var on = t.dataset.tab === key;
      t.classList.toggle('tab-switcher__tab--active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
    });

    panels.forEach(function (p) {
      if (p.dataset.panel === key) {
        p.removeAttribute('hidden');
      } else {
        p.setAttribute('hidden', '');
      }
    });

    page.dataset.activeTab = key;

    if (push) {
      var url = new URL(window.location.href);
      url.searchParams.set('tab', key);
      url.hash = '';
      history.pushState({ tab: key }, '', url.toString());
    }
  }

  /* ── Tab clicks ───────────────────────────────────────────── */
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      if (tab.dataset.tab !== page.dataset.activeTab) {
        activateTab(tab.dataset.tab, true);
      }
    });

    /* Arrow key navigation (ARIA tablist pattern) */
    tab.addEventListener('keydown', function (e) {
      var next;
      if (e.key === 'ArrowRight') next = tabs[i + 1] || tabs[0];
      if (e.key === 'ArrowLeft')  next = tabs[i - 1] || tabs[tabs.length - 1];
      if (next) {
        next.focus();
        next.click();
      }
    });
  });

  /* ── Popstate (back/forward) ──────────────────────────────── */
  window.addEventListener('popstate', function (e) {
    var key = (e.state && e.state.tab)
      ? e.state.tab
      : new URL(window.location.href).searchParams.get('tab') || 'products';
    activateTab(key, false);
  });

})();