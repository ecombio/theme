/* =============================================================================
   ECOMBIO Header JS  |  assets/header.js
   Handles:
     1. Category filter dropdowns (multiple instances: desktop + mobile)
     2. Mobile / tablet drawer nav (hamburger toggle)
     3. Header height CSS variable (--ecombio-header-height)
   ============================================================================= */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  /* ===========================================================================
     1. CATEGORY DROPDOWNS
     =========================================================================== */

  function initCategoryDropdowns() {
    document.querySelectorAll('.ecombio-search__cat-btn').forEach(function (btn) {

      var suffix  = btn.id.replace('ecombio-cat-btn-', '');
      var list    = document.getElementById('ecombio-cat-list-'  + suffix);
      var label   = document.getElementById('ecombio-cat-label-' + suffix);
      var hidden  = document.getElementById('ecombio-cat-value-' + suffix);

      if (!list) return;

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        setDropdown(!isOpen(list), btn, list);
      });

      list.addEventListener('click', function (e) {
        var item = e.target.closest('li[role="option"]');
        if (item) selectOption(item, btn, list, label, hidden);
      });

      list.addEventListener('keydown', function (e) {
        var items   = Array.from(list.querySelectorAll('li[role="option"]'));
        var current = document.activeElement;
        var idx     = items.indexOf(current);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          (items[idx + 1] || items[0]).focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          (items[idx - 1] || items[items.length - 1]).focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (current.matches('li[role="option"]')) {
            selectOption(current, btn, list, label, hidden);
          }
        } else if (e.key === 'Escape') {
          setDropdown(false, btn, list);
          btn.focus();
        }
      });

      btn.closest('.ecombio-search__category').addEventListener('focusout', function (e) {
        var category = btn.closest('.ecombio-search__category');
        if (!category.contains(e.relatedTarget)) {
          setDropdown(false, btn, list);
        }
      });
    });

    document.addEventListener('click', function () {
      document.querySelectorAll('.ecombio-search__cat-list').forEach(function (list) {
        if (!isOpen(list)) return;
        var suffix = list.id.replace('ecombio-cat-list-', '');
        var btn    = document.getElementById('ecombio-cat-btn-' + suffix);
        setDropdown(false, btn, list);
      });
    });
  }

  function isOpen(list) {
    return !list.hidden;
  }

  function setDropdown(open, btn, list) {
    list.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));

    if (open) {
      list.querySelectorAll('li[role="option"]').forEach(function (li) {
        li.setAttribute('tabindex', '0');
      });
      var selected = list.querySelector('li[aria-selected="true"]') || list.querySelector('li');
      if (selected) selected.focus();
    }
  }

  function selectOption(item, btn, list, label, hidden) {
    list.querySelectorAll('li[role="option"]').forEach(function (li) {
      li.setAttribute('aria-selected', 'false');
    });

    item.setAttribute('aria-selected', 'true');
    if (label) label.textContent = item.textContent.trim();
    if (hidden) hidden.value = item.dataset.value || '';

    setDropdown(false, btn, list);
    btn.focus();
  }

  /* ===========================================================================
     2. MOBILE / TABLET DRAWER NAV
     =========================================================================== */

  function initDrawer() {
    var toggle  = document.getElementById('ecombio-nav-toggle');
    var close   = document.getElementById('ecombio-nav-close');
    var overlay = document.getElementById('ecombio-nav-overlay');
    var drawer  = document.getElementById('ecombio-mobile-nav');

    if (!toggle || !drawer) return;

    toggle.addEventListener('click', function () { openDrawer(); });
    if (close)   close.addEventListener('click',   function () { closeDrawer(); });
    if (overlay) overlay.addEventListener('click', function () { closeDrawer(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        closeDrawer();
      }
    });

    function openDrawer() {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      toggle.focus();
    }
  }

  /* ===========================================================================
     3. HEADER HEIGHT CSS VARIABLE
     Sets --ecombio-header-height on :root so the sticky menu bar always sits
     flush underneath the header regardless of its height at any breakpoint.
     =========================================================================== */

  function initHeaderHeight() {
    var headerGroup = document.querySelector('.shopify-section-group-header-group');
    var header      = document.getElementById('ecombio-header');

    // Prefer the full group if available, fall back to just the header element
    var target = headerGroup || header;
    if (!target) return;

    function update() {
      var height = target.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--ecombio-header-height', height + 'px');
    }

    // Set immediately, then watch for size changes (font load, resize, etc.)
    update();
    window.addEventListener('resize', update);

    // ResizeObserver catches height changes without needing a resize event
    // (e.g. search row appearing on tablet, banner dismissal, etc.)
    if (window.ResizeObserver) {
      new ResizeObserver(update).observe(target);
    }
  }

  /* ===========================================================================
     INIT
     =========================================================================== */

  function init() {
    initCategoryDropdowns();
    initDrawer();
    initHeaderHeight();
  }

})();