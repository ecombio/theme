/**
 * Main Header Controller
 * File: assets/main-header.js
 * Loaded by: sections/main-header.liquid (defer)
 *
 * Handles sticky + auto-hide behavior + CSS var syncing for dropdowns.
 */
(function () {
  'use strict';

  var header = document.getElementById('main-header');
  var toolbar = document.querySelector('.collection-toolbar');

  if (!header || !header.classList.contains('main-header--sticky-enabled')) {
    return;
  }

  var STICKY_THRESHOLD = 60;
  var AUTOHIDE_DELTA = 10; // slightly higher = fewer unnecessary toggles
  var isAutohide = header.classList.contains('main-header--sticky-autohide');

  var root = document.documentElement;
  var scrollAnchorY = window.scrollY;

  var bottomRafId = null;
  var stickyRafId = null;
  var resizeTimer = null;

  /* ───────────────────────────────────────────────────────────────────── */
  /* CSS Custom Properties */
  /* ───────────────────────────────────────────────────────────────────── */

  var setHeaderHeightVar = function () {
    root.style.setProperty('--sticky-header-height', header.offsetHeight + 'px');
  };

  var setToolbarHeightVar = function () {
    if (!toolbar) return;
    var rect = toolbar.getBoundingClientRect();
    var marginBottom = parseFloat(getComputedStyle(toolbar).marginBottom) || 0;
    root.style.setProperty('--sticky-toolbar-height', (rect.height + marginBottom) + 'px');
  };

  var setHeaderBottomVar = function () {
    // When sticky, bottom is always 0 (fixed at top)
    if (header.classList.contains('is-sticky')) {
      root.style.setProperty('--main-header-bottom', '0px');
    } else {
      root.style.setProperty('--main-header-bottom', header.getBoundingClientRect().bottom + 'px');
    }
  };

  var scheduleHeaderBottomUpdate = function () {
    if (bottomRafId !== null) return;
    bottomRafId = window.requestAnimationFrame(function () {
      bottomRafId = null;
      setHeaderBottomVar();
    });
  };

  /* ───────────────────────────────────────────────────────────────────── */
  /* Resize handling */
  /* ───────────────────────────────────────────────────────────────────── */

  var handleResize = function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      setHeaderHeightVar();
      setToolbarHeightVar();
      setHeaderBottomVar();
    }, 80);
  };

  /* ───────────────────────────────────────────────────────────────────── */
  /* Core scroll handler (rAF throttled) */
  /* ───────────────────────────────────────────────────────────────────── */

  var handleStickyScroll = function () {
    setHeaderBottomVar();

    var currentScrollY = window.scrollY;
    var wasSticky = header.classList.contains('is-sticky');

    if (currentScrollY > STICKY_THRESHOLD) {
      header.classList.add('is-sticky', 'is-scrolled');

      if (isAutohide) {
        if (!wasSticky) {
          scrollAnchorY = currentScrollY;
        } else {
          var delta = currentScrollY - scrollAnchorY;

          if (delta > AUTOHIDE_DELTA) {
            header.classList.add('is-hidden');
            scrollAnchorY = currentScrollY;
          } else if (delta < -AUTOHIDE_DELTA) {
            header.classList.remove('is-hidden');
            scrollAnchorY = currentScrollY;
          }
        }
      }
    } else {
      header.classList.remove('is-sticky', 'is-scrolled', 'is-hidden');
      scrollAnchorY = currentScrollY;
      header.dispatchEvent(new CustomEvent('main-header:unstick'));
    }
  };

  var scheduleStickyUpdate = function () {
    if (stickyRafId !== null) return;
    stickyRafId = window.requestAnimationFrame(function () {
      stickyRafId = null;
      handleStickyScroll();
    });
  };

  /* ───────────────────────────────────────────────────────────────────── */
  /* Initialization */
  /* ───────────────────────────────────────────────────────────────────── */

  setHeaderHeightVar();
  setToolbarHeightVar();
  setHeaderBottomVar();

  window.addEventListener('scroll', scheduleStickyUpdate, { passive: true });
  window.addEventListener('resize', handleResize);
  handleStickyScroll();

  /* ResizeObserver for dynamic height changes */
  if ('ResizeObserver' in window) {
    var headerRO = new ResizeObserver(function () {
      setHeaderHeightVar();
      scheduleHeaderBottomUpdate();
    });
    headerRO.observe(header);

    if (toolbar) {
      var toolbarRO = new ResizeObserver(setToolbarHeightVar);
      toolbarRO.observe(toolbar);
    }
  }
})();