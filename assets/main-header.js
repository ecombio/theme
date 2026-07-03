/**
 * Main Header Controller
 * File: assets/main-header.js
 * Loaded by: sections/main-header.liquid (defer)
 *
 * Responsibilities:
 *   1. Sticky scroll behavior (.is-sticky / .is-scrolled, CSS var sync,
 *      sticky hamburger) — merged in from assets/main-header-sticky.js
 *   2. Hamburger → mobile nav drawer (open / close / Escape / outside-click)
 *   3. Focus trap inside the open mobile nav
 *   4. Body scroll lock while nav is open
 *
 * MERGE NOTE: this file used to carry its own lighter sticky-scroll
 * implementation (a bare `window.scrollY > 4` check toggling only
 * .is-scrolled). That's been replaced with main-header-sticky.js's
 * version below, since it's the more complete implementation — it also
 * owns .is-sticky, syncs --sticky-header-height / --sticky-toolbar-height
 * CSS custom properties via ResizeObserver, and drives the sticky
 * hamburger. Only one sticky module should exist now; if
 * assets/main-header-sticky.js is still being loaded as its own
 * <script> tag anywhere, remove that tag — otherwise you're back to two
 * listeners fighting over .is-scrolled.
 *
 * Cart button/badge behaviour is NOT handled here — that logic lives
 * entirely in assets/header-cart.js, which is the correct, complete
 * implementation (real selectors, badge pop animation, drawer-open/close
 * aria sync). This file used to duplicate a broken version of that logic
 * (wrong element ID, wrong badge selector) — it's been removed rather
 * than merged in, since header-cart.js already covers it correctly.
 *
 * Search (predictive search, voice, category pill, recent searches) is
 * entirely handled by assets/header-search.js — this file does NOT touch
 * any .hs__* elements.
 */

(function () {
  'use strict';

  /* ── Element refs ─────────────────────────────────────────────────────── */
  var header          = document.getElementById('main-header');
  var navToggle        = document.getElementById('main-header-nav-toggle');
  var mobileNav        = document.getElementById('main-header-mobile-nav');
  var stickyHamburger  = document.querySelector('.main-header-sticky__hamburger');
  var menuBar          = document.querySelector('.menu-bar');
  var toolbar          = document.querySelector('.collection-toolbar');

  /* ── Focusable selector for focus trap ───────────────────────────────── */
  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /* ─────────────────────────────────────────────────────────────────────
     STICKY SCROLL BEHAVIOR
     Only runs if sticky header is enabled via theme setting.
     ───────────────────────────────────────────────────────────────────── */
  if (header && header.classList.contains('main-header--sticky-enabled')) {
    var STICKY_THRESHOLD = 60;
    var root = document.documentElement;

    var setHeaderHeightVar = function () {
      root.style.setProperty('--sticky-header-height', header.offsetHeight + 'px');
    };

    var setToolbarHeightVar = function () {
      if (!toolbar) return;
      var rect = toolbar.getBoundingClientRect();
      var marginBottom = parseFloat(getComputedStyle(toolbar).marginBottom) || 0;
      root.style.setProperty('--sticky-toolbar-height', (rect.height + marginBottom) + 'px');
    };

    /* Debounce resize so we're not writing custom properties on every
       pixel of a drag-resize */
    var resizeTimer;
    var handleResize = function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        setHeaderHeightVar();
        setToolbarHeightVar();
      }, 100);
    };

    var handleStickyScroll = function () {
      if (window.scrollY > STICKY_THRESHOLD) {
        header.classList.add('is-sticky');
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-sticky');
        header.classList.remove('is-scrolled');

        /* Collapse the nav and reset the hamburger once we leave sticky mode */
        if (menuBar) menuBar.classList.remove('is-visible');
        if (stickyHamburger) {
          stickyHamburger.classList.remove('is-active');
          stickyHamburger.setAttribute('aria-expanded', 'false');
        }
      }
    };

    /* Initial measurement, before first paint of dependent consumers */
    setHeaderHeightVar();
    setToolbarHeightVar();

    window.addEventListener('scroll', handleStickyScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    handleStickyScroll();

    /* ResizeObserver catches height changes resize alone won't — e.g. the
       menu bar expanding when the sticky hamburger is toggled open, the
       mobile search row toggling, or font/zoom-driven reflow. */
    if ('ResizeObserver' in window) {
      var headerRO = new ResizeObserver(setHeaderHeightVar);
      headerRO.observe(header);

      if (toolbar) {
        var toolbarRO = new ResizeObserver(setToolbarHeightVar);
        toolbarRO.observe(toolbar);
      }
    }

    /* Hamburger <-> X toggle, only reachable while sticky (button is
       hidden otherwise) */
    if (stickyHamburger && menuBar) {
      stickyHamburger.addEventListener('click', function () {
        var isOpen = menuBar.classList.toggle('is-visible');
        stickyHamburger.classList.toggle('is-active', isOpen);
        stickyHamburger.setAttribute('aria-expanded', String(isOpen));
        /* Height change from the menu bar opening/closing is caught by
           the ResizeObserver above — no manual recalculation needed here. */
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     MOBILE NAV DRAWER
     ───────────────────────────────────────────────────────────────────── */
  if (!navToggle || !mobileNav) {
    /* Mobile nav elements are optional — skip gracefully */
    return;
  }

  var navOpen = false;

  function focusableEls() {
    return Array.prototype.slice.call(mobileNav.querySelectorAll(FOCUSABLE));
  }

  function openNav() {
    navOpen = true;
    mobileNav.hidden = false;
    mobileNav.removeAttribute('aria-hidden');
    mobileNav.classList.add('is-open');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.classList.add('is-open');
    document.body.classList.add('nav-is-open');
    var first = focusableEls()[0];
    if (first) first.focus();
  }

  function closeNav() {
    navOpen = false;
    mobileNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.classList.remove('is-open');
    document.body.classList.remove('nav-is-open');
    navToggle.focus();

    mobileNav.addEventListener('transitionend', function onEnd() {
      mobileNav.removeEventListener('transitionend', onEnd);
      if (!navOpen) {
        mobileNav.hidden = true;
        mobileNav.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function trapFocus(e) {
    if (!navOpen) return;
    var els   = focusableEls();
    if (!els.length) return;
    var first = els[0];
    var last  = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }

  navToggle.addEventListener('click', function () {
    navOpen ? closeNav() : openNav();
  });

  document.addEventListener('click', function (e) {
    /* Use navToggle.contains(e.target) rather than a strict equality
       check — the hamburger button has three <span> children
       (.main-header__hamburger-line) that are frequently the actual
       click target. A strict !== check treated a click on those spans
       as an "outside" click, so openNav() (from the toggle handler
       above) and closeNav() (from this handler) fired in the same
       tick: the drawer opened and immediately closed again. .contains()
       correctly matches clicks anywhere inside the button, including
       its child spans. */
    if (navOpen && !mobileNav.contains(e.target) && !navToggle.contains(e.target)) {
      closeNav();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && navOpen) { closeNav(); return; }
    if (e.key === 'Tab'    && navOpen) { trapFocus(e); }
  });

})();