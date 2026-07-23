/* ============================================================
   product-reviews.js
   Self-contained — pairs with sections/product-reviews.liquid
   and product-reviews.css only.

   This does not fetch or render review data itself — Judge.me's
   own storefront script (installed via the app) does that, by
   populating #judgeme_product_reviews and adding a
   `jdgm--done-setup-widget` class to it once done.

   This file's only job: watch for that class, and — same lesson
   learned from the Frequently Bought Together / Related Products
   fixes — if it never appears (Judge.me app disabled, its script
   blocked, or genuinely zero reviews and the widget stays empty),
   hide the ENTIRE section rather than leaving a stuck shimmer
   skeleton visible indefinitely.
   ============================================================ */

(function () {
  'use strict';

  var READY_CLASS   = 'jdgm--done-setup-widget';
  var TIMEOUT_MS    = 8000;

  function initSection(wrapperEl) {
    var widgetEl = wrapperEl.querySelector('#judgeme_product_reviews');
    var innerWrap = wrapperEl.querySelector('[data-revs-widget-wrapper]');

    if (!widgetEl || !innerWrap) {
      wrapperEl.hidden = true;
      return;
    }

    var settled = false;

    function markLoaded() {
      if (settled) return;
      settled = true;
      innerWrap.setAttribute('data-revs-loaded', 'true');
      wrapperEl.hidden = false;
      observer.disconnect();
      clearTimeout(timeoutId);
    }

    function markFailed() {
      if (settled) return;
      settled = true;
      wrapperEl.hidden = true;
      observer.disconnect();
    }

    // If the widget was already populated by the time this runs
    // (e.g. fast script, or shopify:section:load re-init), skip
    // straight to loaded.
    if (widgetEl.classList.contains(READY_CLASS)) {
      markLoaded();
      return;
    }

    var observer = new MutationObserver(function () {
      if (widgetEl.classList.contains(READY_CLASS)) {
        markLoaded();
      }
    });

    observer.observe(widgetEl, { attributes: true, attributeFilter: ['class'] });

    var timeoutId = setTimeout(function () {
      // Judge.me never finished setting up the widget in time —
      // hide the whole section instead of leaving shimmer forever.
      markFailed();
    }, TIMEOUT_MS);
  }

  function init() {
    document.querySelectorAll('[data-revs-section]').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (e) {
    var section = e.target.querySelector('[data-revs-section]');
    if (section) initSection(section);
  });
})();