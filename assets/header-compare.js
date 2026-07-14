/* ============================================================
   header-compare.js
   Keeps the header compare icon's badge and label count in sync
   with the 'shopify_compare' localStorage list.

   Storage format (matches main-compare.js / product-card.js):
     [{ id: "123456", handle: "my-product", … }, …]
     (product-card.js also stores title/image/price alongside id/handle
     for its own compare-bar thumbnails — this file only reads .handle,
     ignoring the rest.)

   Rather than trust any single event's payload, this file always
   re-reads localStorage directly whenever a relevant event fires.
   That makes it correct regardless of which surface changed the
   list — product-card.js's checkboxes, the compare-bar, or
   main-compare.js's remove/clear buttons on the compare page itself.

   Listens for:
     - 'compare:toggle'   (main-compare.js's removeProduct)
     - 'compare:cleared'  (main-compare.js's clear-all handler)
     - 'compare:updated'  (product-card.js's compare checkboxes)
     - 'storage'          (list changed in another tab)
   ============================================================ */

(function () {
  'use strict';

  var COMPARE_KEY = 'shopify_compare';

  function getCompareList() {
    try { return JSON.parse(localStorage.getItem(COMPARE_KEY)) || []; }
    catch (e) { return []; }
  }

  var link = document.querySelector('[data-header-compare]');
  if (!link) return;

  var badge      = link.querySelector('[data-header-compare-badge]');
  var labelCount = link.querySelector('[data-header-compare-label-count]');
  var sr         = link.querySelector('[data-header-compare-sr]');

  function render() {
    var count = getCompareList().filter(function (entry) {
      return entry && typeof entry === 'object' && entry.handle;
    }).length;

    if (badge) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }

    if (labelCount) {
      labelCount.textContent = '(' + count + ')';
      labelCount.hidden = count === 0;
    }

    if (sr) {
      sr.textContent = count === 0
        ? 'Compare, no products selected'
        : 'Compare, ' + count + (count === 1 ? ' product selected' : ' products selected');
    }
  }

  document.addEventListener('compare:toggle',  render);
  document.addEventListener('compare:cleared', render);
  document.addEventListener('compare:updated', render);

  window.addEventListener('storage', function (e) {
    if (e.key === COMPARE_KEY) render();
  });

  render();
})();