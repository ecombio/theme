/*
 * assets/header-group.js
 *
 * Two jobs:
 * 1. Give every .shopify-section inside #shopify-section-group-header-group
 *    its own `top` offset, equal to the summed height of the sticky
 *    sections before it — so each section sticks independently and they
 *    stack in order instead of overlapping. Recalculated on resize and
 *    whenever a section's own height changes (ResizeObserver), since
 *    announcement-bar text length, breakpoint, and theme settings can
 *    all change section height at runtime.
 * 2. Toggle .header-group--hidden on the group wrapper on scroll-down /
 *    remove it on scroll-up, when autohide is enabled. This still moves
 *    the whole stack as one unit via transform (see header-group.css).
 *
 * Loaded once, centrally, from theme.liquid (defer), so it runs on
 * every page regardless of which sections are present in the group.
 */
(function () {
  'use strict';

  var wrapper = document.getElementById('shopify-section-group-header-group');

  if (!wrapper) {
    console.warn(
      '[header-group.js] #shopify-section-group-header-group not found in the DOM. ' +
      'Sticky/autohide will not run. This element is normally rendered automatically ' +
      'by {% sections \'header-group\' %} in theme.liquid — check that tag is still present.'
    );
    return;
  }

  var stickyEnabled = document.body.getAttribute('data-sticky-header') === 'true';
  var autohideEnabled = document.body.getAttribute('data-header-autohide') === 'true';

  if (!stickyEnabled) {
    // Sticky is off entirely — nothing for this script to do. Not a
    // warning, just an expected no-op state controlled by the theme setting.
    return;
  }

  var sections = Array.prototype.slice.call(wrapper.children).filter(function (el) {
    return el.classList.contains('shopify-section');
  });

  // Job 1 — per-section sticky offsets, so multiple sections in the
  // group stack correctly instead of overlapping.
  var applyStickyOffsets = function () {
    var cumulative = 0;
    sections.forEach(function (section) {
      section.style.top = cumulative + 'px';
      cumulative += section.offsetHeight;
    });
  };

  applyStickyOffsets();
  window.addEventListener('resize', applyStickyOffsets);

  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(applyStickyOffsets);
    sections.forEach(function (section) { ro.observe(section); });
  }

  // Exposed so other scripts (or a future section script) can force a
  // recalc after something changes a section's height programmatically.
  window.__headerGroupSync = applyStickyOffsets;

  if (!autohideEnabled) {
    // Sticky but no autohide — header-group.css already keeps each
    // section pinned via position: sticky with no further JS needed.
    return;
  }

  // Job 2 — scroll-driven autohide, unchanged in behavior from before,
  // just now toggling the class on the group wrapper regardless of how
  // many sections are stacked inside it.
  var THRESHOLD = 8; // px of scroll delta before we react, avoids jitter on tiny scroll events
  var MIN_SCROLL_BEFORE_HIDE = wrapper.offsetHeight; // don't hide until the stack has fully scrolled past itself

  var lastScrollY = window.scrollY;
  var ticking = false;

  var update = function () {
    var currentScrollY = window.scrollY;
    var delta = currentScrollY - lastScrollY;

    if (Math.abs(delta) < THRESHOLD) {
      ticking = false;
      return;
    }

    if (currentScrollY <= MIN_SCROLL_BEFORE_HIDE) {
      wrapper.classList.remove('header-group--hidden');
    } else if (delta > 0) {
      // scrolling down
      wrapper.classList.add('header-group--hidden');
    } else {
      // scrolling up
      wrapper.classList.remove('header-group--hidden');
    }

    lastScrollY = currentScrollY;
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true }
  );
})();