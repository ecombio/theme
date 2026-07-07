/* assets/main-search.js
   MVP script for sections/main-search.liquid.
   Repurposed from main-collection.js — kept intentionally small:
   just the mobile filter drawer + backdrop, and the sort select.
   No live AJAX re-fetching, no tabs, no mobile sort sheet.
   The filter form is a plain <form method="get">, so it works
   even if this file fails to load — this JS only adds the
   mobile drawer open/close UX on top of that. */

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

  if (!filterPanel) return;

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