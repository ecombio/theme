/* This file owns sticky-scroll behavior only — snippet-specific scripts live in each snippet's own JS file. */
/**
 * Main Header Controller
 * File: assets/main-header.js
 * Loaded by: sections/main-header.liquid (defer)
 *
 * Responsibilities:
 *   1. Sticky scroll behavior (.is-sticky / .is-scrolled, CSS var sync)
 *      — merged in from assets/main-header-sticky.js
 *
 * Hamburger buttons and the mobile nav drawer (open/close/Escape/
 * outside-click, focus trap, body scroll lock, and the sticky
 * hamburger's own click-to-toggle-.menu-bar behavior) all moved to
 * assets/header-hamburger.js, loaded by snippets/header-hamburger.liquid.
 * This file no longer touches any hamburger/drawer elements directly.
 *
 * Coordination with header-hamburger.js: when the scroll handler below
 * detects we've left sticky mode, it dispatches a `main-header:unstick`
 * CustomEvent on #main-header instead of resetting the sticky
 * hamburger/.menu-bar state itself. header-hamburger.js listens for that
 * event and resets its own state. Neither file needs to know the other's
 * internals beyond that one event name — see header-hamburger.js for the
 * listener.
 *
 * MERGE NOTE: this file used to carry its own lighter sticky-scroll
 * implementation (a bare `window.scrollY > 4` check toggling only
 * .is-scrolled). That's been replaced with main-header-sticky.js's
 * version below, since it's the more complete implementation — it also
 * owns .is-sticky and syncs --sticky-header-height /
 * --sticky-toolbar-height CSS custom properties via ResizeObserver. Only
 * one sticky module should exist now; if assets/main-header-sticky.js is
 * still being loaded as its own <script> tag anywhere, remove that tag —
 * otherwise you're back to two listeners fighting over .is-scrolled.
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
  var header  = document.getElementById('main-header');
  var toolbar = document.querySelector('.collection-toolbar');

  /* ─────────────────────────────────────────────────────────────────────
     STICKY SCROLL BEHAVIOR
     Only runs if sticky header is enabled via theme setting.
     ───────────────────────────────────────────────────────────────────── */
  if (!header || !header.classList.contains('main-header--sticky-enabled')) {
    return;
  }

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

      /* Let header-hamburger.js know we've left sticky mode, so it can
         reset its own hamburger/.menu-bar state. See file header
         comment above for why this is an event rather than a direct
         DOM reset. */
      header.dispatchEvent(new CustomEvent('main-header:unstick'));
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

})();