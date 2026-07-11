/* assets/collection-toolbar.js
   Behavior for snippets/collection-toolbar.liquid. Fully
   self-contained: everything it queries (#collection-toolbar and its
   descendants) lives inside that snippet's own markup.

   Coordinates with collection-feed.js ONLY through:
     - a `collection:tabchange` CustomEvent on `document`, fired on
       tab click
     - the `?tab=` URL param, read independently by both scripts on
       `popstate`
   Neither script queries into the other's DOM, so either snippet can
   be reordered, reused elsewhere, or removed without breaking the
   other.

   Also writes `data-active-tab` onto [data-collection-page] (the
   .collection-page wrapper in main-collection.liquid) whenever the
   tab changes — collection-filter.js's buildFilterUrl() reads that
   attribute to preserve the active tab on filter/sort requests. Make
   sure main-collection.liquid actually renders that attribute.

   Uses `window.CollectionBackdrop` (defined in main-collection.js)
   for the shared full-page overlay behind the mobile sort sheet —
   that overlay element is a page-level fixture shared with the
   filter sidebar, so it stays owned by the parent section rather
   than duplicated here.

   NOTE: active-filters horizontal scroll (prev/next nav + overflow
   detection) is NOT handled here — it's owned exclusively by
   collection-filter.js's initActiveFiltersNav(), since that function
   also has to re-run after every AJAX filter swap. An earlier version
   of this file duplicated that listener binding, which caused
   prev/next clicks to fire two scrollBy() calls at once. Don't
   re-add it here. */

(function () {
  'use strict';

  var toolbar = document.getElementById('collection-toolbar');
  if (!toolbar) return;

  var collectionPage = document.querySelector('[data-collection-page]');

  /* ══════════════════════════════════════════════════════════
     TABS
  ══════════════════════════════════════════════════════════ */
  var tabs = toolbar.querySelectorAll('[data-tab]');

  function setActiveTab(key) {
    tabs.forEach(function (t) {
      var on = t.dataset.tab === key;
      t.classList.toggle('tab-switcher__tab--active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
    });
    toolbar.dataset.activeTab = key;

    if (collectionPage) {
      collectionPage.dataset.activeTab = key;
    }
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      var key = tab.dataset.tab;
      if (key === toolbar.dataset.activeTab) return;

      setActiveTab(key);

      var url = new URL(window.location.href);
      url.searchParams.set('tab', key);
      url.hash = '';
      history.pushState({ tab: key }, '', url.toString());

      document.dispatchEvent(new CustomEvent('collection:tabchange', { detail: { tab: key } }));
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

  window.addEventListener('popstate', function () {
    var key = new URL(window.location.href).searchParams.get('tab') || 'products';
    setActiveTab(key);
  });

  /* ══════════════════════════════════════════════════════════
     SORT SELECT (desktop)
  ══════════════════════════════════════════════════════════ */
  var sortSelect = toolbar.querySelector('[data-sort]');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sort_by', sortSelect.value);
      window.location.href = url.toString();
    });
  }

  /* ══════════════════════════════════════════════════════════
     MOBILE SORT SHEET
     Built lazily on first open. Mirrors options from the desktop
     #SortBy select (also inside this snippet) so there's a single
     source of truth.
  ══════════════════════════════════════════════════════════ */
  var mobileSortBtn = toolbar.querySelector('[data-mobile-sort-toggle]');

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

      if (sortSelect) {
        Array.from(sortSelect.options).forEach(function (opt) {
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
      if (window.CollectionBackdrop) window.CollectionBackdrop.open(closeSortSheet);
    }

    function closeSortSheet() {
      if (!sortSheet) return;
      sortSheet.classList.remove('is-open');
      mobileSortBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (window.CollectionBackdrop) window.CollectionBackdrop.close(closeSortSheet);
    }

    mobileSortBtn.addEventListener('click', function () {
      sortSheet && sortSheet.classList.contains('is-open')
        ? closeSortSheet()
        : openSortSheet();
    });
  }

})();