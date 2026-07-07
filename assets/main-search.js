/* assets/main-search.js
   MVP script for sections/main-search.liquid.
   Repurposed from main-collection.js — mobile filter drawer +
   backdrop, sort select, and now a Products/Articles tab
   switcher (both panels already rendered server-side from the
   same paginated search.results, so switching is just a
   show/hide + history update — no re-fetch, mirroring the tab
   logic in collection-feed.js but without any AJAX filtering). */

(function () {
  'use strict';

  var filterPanel = document.getElementById('collection-filter');
  var filterToggles = document.querySelectorAll('[data-filter-toggle]');
  var backdrop = document.querySelector('.collection-mobile-backdrop');

  /* ── Shared backdrop ──────────────────────────────────────── */
  function openBackdrop() {
    if (backdrop) backdrop.classList.add('is-visible');
  }

  function closeBackdrop() {
    if (backdrop) backdrop.classList.remove('is-visible');
  }

  if (backdrop) {
    backdrop.addEventListener('click', function () {
      closeFilter();
    });
  }

  if (filterPanel) {
    /* ── Inject mobile close bar (once) ───────────────────────── */
    if (!filterPanel.querySelector('.collection-filter__close')) {
      var closeBar = document.createElement('div');
      closeBar.className = 'collection-filter__close';
      closeBar.innerHTML =
        '<span class="collection-filter__close-label">Filters</span>' +
        '<button class="collection-filter__close-btn" type="button" aria-label="Close filters">&times;</button>';
      filterPanel.insertBefore(closeBar, filterPanel.firstChild);
      closeBar.querySelector('.collection-filter__close-btn').addEventListener('click', closeFilter);
    }

    /* ── Open / close (mobile drawer) ─────────────────────────── */
    function openFilter() {
      filterPanel.removeAttribute('hidden');
      requestAnimationFrame(function () {
        filterPanel.classList.add('is-open');
      });
      filterToggles.forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
      document.body.style.overflow = 'hidden';
      openBackdrop();
    }

    function closeFilter() {
      filterPanel.classList.remove('is-open');
      filterToggles.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
      document.body.style.overflow = '';
      closeBackdrop();

      filterPanel.addEventListener('transitionend', function handler() {
        if (!filterPanel.classList.contains('is-open')) {
          filterPanel.setAttribute('hidden', '');
        }
        filterPanel.removeEventListener('transitionend', handler);
      });
    }

    /* ── Toggle buttons ────────────────────────────────────────── */
    filterToggles.forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        var isMobile = window.innerWidth <= 768;

        if (isMobile) {
          filterPanel.classList.contains('is-open') ? closeFilter() : openFilter();
        } else {
          var isOpen = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
          filterPanel.toggleAttribute('hidden', isOpen);

          var body = document.querySelector('.collection-body');
          if (body) body.classList.toggle('collection-body--filters-hidden', isOpen);
        }
      });
    });
  }

  /* ── Sort select — plain redirect, no AJAX ────────────────── */
  var sortSelect = document.querySelector('[data-sort]');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sort_by', sortSelect.value);
      window.location.href = url.toString();
    });
  }

})();

/* ── Tabs (Products / Articles) ─────────────────────────────── */
(function () {
  'use strict';

  var page = document.querySelector('[data-search-page]');
  if (!page) return;

  var tabs      = page.querySelectorAll('[data-tab]');
  var panels    = page.querySelectorAll('[data-panel]');
  var tabInputs = document.querySelectorAll('[data-tab-input]');

  if (!tabs.length || !panels.length) return;

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
    // Keep the filter form's hidden "tab" input in sync so a plain
    // GET submit (no AJAX here, unlike collection's filter form)
    // doesn't silently bounce the user back to the Products tab.
    tabInputs.forEach(function (input) { input.value = key; });

    if (push) {
      var url = new URL(window.location.href);
      url.searchParams.set('tab', key);
      history.pushState({ tab: key }, '', url.toString());
    }
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      if (tab.dataset.tab !== page.dataset.activeTab) {
        activateTab(tab.dataset.tab, true);
      }
    });

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

  window.addEventListener('popstate', function (e) {
    var key = (e.state && e.state.tab)
      ? e.state.tab
      : new URL(window.location.href).searchParams.get('tab') || 'products';
    activateTab(key, false);
  });

})();