/* =============================================================================
   ECOMBIO Header JS  |  assets/header.js
   Handles:
     1. Category filter dropdowns (multiple instances: desktop + mobile)
     2. Mobile / tablet drawer nav (hamburger toggle)
     3. Header height CSS variable (--ecombio-header-height)
     4. Sticky header menu toggle (hamburger → X, only visible when sticky)
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
     =========================================================================== */

  function initHeaderHeight() {
    var headerGroup = document.querySelector('.shopify-section-group-header-group');
    var header      = document.getElementById('ecombio-header');

    var target = headerGroup || header;
    if (!target) return;

    function update() {
      var height = target.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--ecombio-header-height', height + 'px');
    }

    update();
    window.addEventListener('resize', update);

    if (window.ResizeObserver) {
      new ResizeObserver(update).observe(target);
    }
  }

  /* ===========================================================================
     4. STICKY HEADER MENU TOGGLE (Hamburger → X)
     Only visible when header is sticky. Opens the mobile nav drawer.
     =========================================================================== */

  function initStickyHeaderToggle() {
    var toggle = document.querySelector('.ecombio-header__sticky-toggle');
    var drawer = document.getElementById('ecombio-mobile-nav');
    var header = document.querySelector('.ecombio-sticky-header');

    if (!toggle || !drawer || !header) return;

    // Detect when header becomes sticky and add .is-sticky class
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          header.classList.toggle('is-sticky', !entry.isIntersecting);
        });
      },
      { threshold: [1] }
    );
    observer.observe(header);

    // Toggle click handler
    toggle.addEventListener('click', function () {
      var isOpen = toggle.getAttribute('aria-expanded') === 'true';

      toggle.setAttribute('aria-expanded', String(!isOpen));
      drawer.classList.toggle('is-open', !isOpen);
      drawer.setAttribute('aria-hidden', String(isOpen));

      if (!isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        toggle.focus();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        toggle.setAttribute('aria-expanded', 'false');
        drawer.classList.remove('is-open');
        document.body.style.overflow = '';
        toggle.focus();
      }
    });
  }

  /* ===========================================================================
     INIT
     =========================================================================== */

  function init() {
    initCategoryDropdowns();
    initDrawer();
    initHeaderHeight();
    initStickyHeaderToggle();     // ← New sticky hamburger toggle
  }

})();