/**
 * assets/main-product.js
 *
 * Section-level bootstrap for the product page.
 *
 * NOTE: This file previously contained the entire #ProductInfo variant-form
 * controller (price/badge/ATC/qty logic). That code was scoped to
 * snippets/product-detail.liquid only, so it has moved to
 * assets/product-detail.js. Load both scripts on the section — this file
 * no longer duplicates that logic.
 *
 * Responsibilities
 * ────────────────
 * 1. Fire a `section:product-loaded` event once the section's DOM is in
 *    place, so any snippet-level script (product-detail.js,
 *    product-media.js) can hook a shared lifecycle if it needs to.
 * 2. Re-fire that event on shopify:section:load for theme-editor support.
 *
 * Add future SECTION-WIDE behavior here (e.g. things that touch both the
 * gallery and the form, or breadcrumbs). Anything scoped to a single
 * snippet's markup belongs in that snippet's own JS file instead.
 */

(function () {
  'use strict';

  const SECTION_ID = 'ProductSection';

  function init(root) {
    var section = root.querySelector
      ? (root.id === SECTION_ID ? root : root.querySelector('#' + SECTION_ID))
      : document.getElementById(SECTION_ID);

    if (!section) return;

    document.dispatchEvent(new CustomEvent('section:product-loaded', {
      bubbles: true,
      detail: { section: section }
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }

  // Theme editor support
  document.addEventListener('shopify:section:load', function (e) {
    init(e.target);
  });

})();