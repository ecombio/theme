/* =============================================================================
   ECOMBIO Header JS  |  assets/header.js
   Handles:
     1. Category filter dropdowns (multiple instances: desktop + mobile)
     2. Mobile / tablet drawer nav (hamburger toggle)
     3. Header height CSS variable (--ecombio-header-height)
     4. Flyout nav — open/close the .mega-menu--flyout container
        (FlyoutPanel handles the sidebar ↔ stage wiring inside the flyout;
         this section handles showing/hiding the flyout itself)
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
    var target      = headerGroup || header;
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
     4. FLYOUT NAV
     -------------------------------------------------------------------------
     The flyout <li> lives in .menu-bar__item--has-flyout.
     Inside it: <a class="menu-bar__link--flyout"> (the trigger)
                <div class="mega-menu mega-menu--flyout">  (the panel)

     This section handles OPENING and CLOSING that outer panel.
     FlyoutPanel (flyout-panel.js) handles the sidebar ↔ stage wiring
     INSIDE the panel once it is already visible.

     Open on:  mouseenter the <li>  |  click the <a>
     Close on: mouseleave the <li>  |  Escape key  |  click outside
     =========================================================================== */

  function initFlyouts() {
    var items = document.querySelectorAll('.menu-bar__item--has-flyout');
    if (!items.length) return;

    var leaveTimer = null;

    items.forEach(function (item) {
      var trigger = item.querySelector('.menu-bar__link--flyout');
      var panel   = item.querySelector('.mega-menu--flyout');
      if (!trigger || !panel) return;

      // ── Mouse ──────────────────────────────────────────────────────────────
      item.addEventListener('mouseenter', function () {
        clearTimeout(leaveTimer);
        openFlyout(item, trigger, panel);
      });

      item.addEventListener('mouseleave', function () {
        // Small delay so cursor can travel from trigger into the panel
        leaveTimer = setTimeout(function () {
          closeFlyout(item, trigger, panel);
        }, 120);
      });

      // ── Click (also covers keyboard Enter/Space on the link) ───────────────
      trigger.addEventListener('click', function (e) {
        var isOpen = item.classList.contains('is-flyout-open');
        if (isOpen) {
          // Second click navigates — let the href through
          return;
        }
        // First click opens the flyout instead of navigating
        e.preventDefault();
        openFlyout(item, trigger, panel);
      });

      // ── Keyboard ───────────────────────────────────────────────────────────
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          if (!item.classList.contains('is-flyout-open')) {
            e.preventDefault();
            openFlyout(item, trigger, panel);
            // Move focus into the first panel trigger
            var firstTrigger = panel.querySelector('.flyout-panel__trigger');
            if (firstTrigger) firstTrigger.focus();
          }
        } else if (e.key === 'Escape') {
          closeFlyout(item, trigger, panel);
          trigger.focus();
        }
      });

      // Tab out of the panel → close
      panel.addEventListener('focusout', function (e) {
        if (!item.contains(e.relatedTarget)) {
          closeFlyout(item, trigger, panel);
        }
      });
    });

    // Click outside closes all open flyouts
    document.addEventListener('click', function (e) {
      items.forEach(function (item) {
        if (!item.contains(e.target) && item.classList.contains('is-flyout-open')) {
          var trigger = item.querySelector('.menu-bar__link--flyout');
          var panel   = item.querySelector('.mega-menu--flyout');
          if (trigger && panel) closeFlyout(item, trigger, panel);
        }
      });
    });

    // Escape from anywhere closes all open flyouts
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      items.forEach(function (item) {
        if (item.classList.contains('is-flyout-open')) {
          var trigger = item.querySelector('.menu-bar__link--flyout');
          var panel   = item.querySelector('.mega-menu--flyout');
          if (trigger && panel) {
            closeFlyout(item, trigger, panel);
            trigger.focus();
          }
        }
      });
    });
  }

  function openFlyout(item, trigger, panel) {
    item.classList.add('is-flyout-open');
    panel.classList.add('mega-menu--open');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function closeFlyout(item, trigger, panel) {
    item.classList.remove('is-flyout-open');
    panel.classList.remove('mega-menu--open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  /* ===========================================================================
     INIT
     =========================================================================== */

  function init() {
    initCategoryDropdowns();
    initDrawer();
    initHeaderHeight();
    initFlyouts();
  }

})();