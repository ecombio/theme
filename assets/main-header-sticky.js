/**
 * Main Header — Sticky Behavior
 * File: assets/main-header-sticky.js
 *
 * Uses position:fixed (see main-header-sticky.css header comment for why
 * position:sticky doesn't work in this theme's section-wrapper structure).
 *
 * Also syncs two CSS custom properties to :root so other sticky elements
 * on the page can position themselves relative to the header without
 * guessing at fixed pixel values:
 *
 *   --sticky-header-height   Real, current rendered height of #main-header.
 *                             Changes with breakpoint, and with whether the
 *                             desktop menu bar is currently open (toggled
 *                             via the sticky hamburger) while sticky.
 *
 *   --sticky-toolbar-height  Real, current rendered height of
 *                             .collection-toolbar, when present on the page.
 *                             Lets .collection-filter clear BOTH the header
 *                             and the toolbar without a hardcoded guess.
 *
 * Both are recalculated on load, on resize, and via ResizeObserver so they
 * stay correct through toggle interactions and responsive layout shifts,
 * not just viewport-width changes.
 */

(function () {
  'use strict';

  var header          = document.getElementById('main-header');
  var stickyHamburger  = document.querySelector('.main-header-sticky__hamburger');
  var menuBar          = document.querySelector('.menu-bar');
  var toolbar          = document.querySelector('.collection-toolbar');

  /* Only run if sticky header is enabled via theme setting */
  if (!header || !header.classList.contains('main-header--sticky-enabled')) return;

  var STICKY_THRESHOLD = 60;
  var root = document.documentElement;

  /* ---------------------------------------------------------------------
     CSS custom property sync
     --------------------------------------------------------------------- */
  function setHeaderHeightVar() {
    root.style.setProperty('--sticky-header-height', header.offsetHeight + 'px');
  }

  function setToolbarHeightVar() {
    if (!toolbar) return;
    root.style.setProperty('--sticky-toolbar-height', toolbar.offsetHeight + 'px');
  }

  /* Debounce resize so we're not writing custom properties on every pixel
     of a drag-resize */
  var resizeTimer;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      setHeaderHeightVar();
      setToolbarHeightVar();
    }, 100);
  }

  function handleScroll() {
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
  }

  /* Initial measurement, before first paint of dependent consumers */
  setHeaderHeightVar();
  setToolbarHeightVar();

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleResize);
  handleScroll();

  /* ResizeObserver catches height changes resize alone won't — e.g. the
     menu bar expanding when the sticky hamburger is toggled open (this is
     what pushes the sticky header from ~64px to ~111px), the mobile search
     row toggling, or font/zoom-driven reflow. Observing the elements
     directly means we don't have to manually recalculate on every state
     change that might affect their height. */
  if ('ResizeObserver' in window) {
    var headerRO = new ResizeObserver(setHeaderHeightVar);
    headerRO.observe(header);

    if (toolbar) {
      var toolbarRO = new ResizeObserver(setToolbarHeightVar);
      toolbarRO.observe(toolbar);
    }
  }

  /* Hamburger <-> X toggle, only reachable while sticky (button is hidden otherwise) */
  if (stickyHamburger && menuBar) {
    stickyHamburger.addEventListener('click', function () {
      var isOpen = menuBar.classList.toggle('is-visible');
      stickyHamburger.classList.toggle('is-active', isOpen);
      stickyHamburger.setAttribute('aria-expanded', String(isOpen));
      /* Height change from the menu bar opening/closing is caught by the
         ResizeObserver above — no manual recalculation needed here. */
    });
  }
    /* Stop sticky when reaching after-items */
  const afterItems = document.querySelector('.after-items');
  if (afterItems) {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        header.classList.remove('is-sticky', 'is-scrolled');
      }
    }, { threshold: 0.1 });
    observer.observe(afterItems);
  }
})();