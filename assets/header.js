/* =============================================================================
   ECOMBIO Header JS  |  assets/header.js
   Handles:
     1. Category filter dropdowns (multiple instances: desktop + mobile)
     2. Mobile / tablet drawer nav (hamburger toggle)
   ============================================================================= */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  /* ===========================================================================
     1. CATEGORY DROPDOWNS
     Works for both the desktop-inline and mobile-row instances.
     =========================================================================== */

  function initCategoryDropdowns() {
    // Find all category buttons on the page (desktop + mobile instances)
    document.querySelectorAll('.ecombio-search__cat-btn').forEach(function (btn) {

      // Derive the sibling list and label from the button's own ID
      // IDs follow the pattern: ecombio-cat-btn-{suffix}
      var suffix  = btn.id.replace('ecombio-cat-btn-', '');
      var list    = document.getElementById('ecombio-cat-list-'  + suffix);
      var label   = document.getElementById('ecombio-cat-label-' + suffix);
      var hidden  = document.getElementById('ecombio-cat-value-' + suffix);

      if (!list) return;

      /* Toggle */
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        setDropdown(!isOpen(list), btn, list);
      });

      /* Select option */
      list.addEventListener('click', function (e) {
        var item = e.target.closest('li[role="option"]');
        if (item) selectOption(item, btn, list, label, hidden);
      });

      /* Keyboard navigation */
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

      /* Close when focus leaves the widget */
      btn.closest('.ecombio-search__category').addEventListener('focusout', function (e) {
        var category = btn.closest('.ecombio-search__category');
        if (!category.contains(e.relatedTarget)) {
          setDropdown(false, btn, list);
        }
      });
    });

    /* Close all dropdowns on outside click */
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

    /* Close on Escape */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        closeDrawer();
      }
    });

    function openDrawer() {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';   // prevent scroll behind overlay
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
     INIT
     =========================================================================== */

  function init() {
    initCategoryDropdowns();
    initDrawer();
  }

})();
