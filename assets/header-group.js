/*
 * assets/header-group.js
 *
 * Only job: toggle .header-group--hidden on #shopify-section-group-header-group
 * when the visitor scrolls down, remove it when they scroll up. The actual
 * sticky positioning and the hidden-state's transform both live in
 * header-group.css — this file never touches inline styles.
 *
 * Loaded once, centrally, from theme.liquid (defer), so it runs on every
 * page regardless of which sections are present in the header group.
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

  var autohideEnabled = document.body.getAttribute('data-header-autohide') === 'true';
  var stickyEnabled = document.body.getAttribute('data-sticky-header') === 'true';

  if (!stickyEnabled) {
    // Sticky is off entirely — nothing for this script to do. Not a
    // warning, just an expected no-op state controlled by the theme setting.
    return;
  }

  if (!autohideEnabled) {
    // Sticky but no autohide — header-group.css already keeps it pinned
    // via position: sticky with no JS involvement needed.
    return;
  }

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