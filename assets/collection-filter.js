/**
 * collection-filter.js
 * Owns all filter and sort interactivity for the collection page.
 *
 * Responsibilities:
 *   • Filter drawer — open/close on desktop toggle + mobile drawer
 *   • Shared backdrop — coordinates with collection.js via
 *     window.CollectionBackdrop (set by collection.js)
 *   • Sort select — navigates on change (desktop)
 *   • Mobile sort sheet — built and opened by collection.js;
 *     sort select is mirrored into the sheet by collection.js
 *   • Filter form — submit preserves active tab in URL
 *
 * Data attribute contracts:
 *   [data-filter-toggle]   — buttons that open/close the drawer
 *   [data-sort]            — sort <select> (desktop)
 *   id="collection-filter" — the filter aside
 *   id="FilterForm"        — the filter <form>
 *   id="collection-filter" — aria-controls target for toggles
 */

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

  /* ── Filter form submit ───────────────────────────────────── */
  var filterForm = document.getElementById('FilterForm');
  if (filterForm) {
    filterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var url = new URL(window.location.href);
      url.search = '';

      new FormData(filterForm).forEach(function (val, key) {
        url.searchParams.append(key, val);
      });

      // Preserve active tab
      var page = document.querySelector('[data-collection-page]');
      var activeTab = page ? page.dataset.activeTab : 'products';
      url.searchParams.set('tab', activeTab);

      window.location.href = url.toString();
    });
  }

  /* ── Expose close for external use (e.g. backdrop click) ─── */
  window.CollectionFilter = { close: closeFilter };

})();
