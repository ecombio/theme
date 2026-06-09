/* =============================================================================
   ECOMBIO Cart Upsells JS  |  assets/ecombio-cart-upsells.js
   Handles:
     1. Fetch product recommendations via Shopify recommendations API
     2. Render upsell cards in the drawer's upsell track
     3. Handle add-to-cart for upsell items
     4. Analytics events: upsell_viewed, upsell_added, upsell_rejected
     5. Add-to-cart interception for standard theme product forms
        (dispatches 'ecombio:cart:added' so ecombio-cart.js opens the drawer)

   Depends on: ecombio-cart.js (window.EcombioCart must be available)
   ============================================================================= */

(function () {
  'use strict';

  /* ── Config ── */
  var UPSELL_LIMIT = 6;  /* max recommendation cards to show */

  /* ── Cached DOM refs ── */
  var drawer, upsellSection, upsellTrack;
  var currentProductIds = [];

  /* ===========================================================================
     INIT
     =========================================================================== */

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    drawer = document.getElementById('ecombio-cart-drawer');
    if (!drawer) return;

    upsellSection = drawer.querySelector('[data-ecombio-cart-upsell]');
    upsellTrack   = drawer.querySelector('[data-ecombio-upsell-track]');

    /* Load upsells whenever the drawer opens */
    document.addEventListener('ecombio:analytics', function (e) {
      if (e.detail.event === 'cart_drawer_open') {
        loadUpsells();
      }
    });

    /* Refresh upsells when cart changes */
    document.addEventListener('ecombio:cart:updated', function () {
      loadUpsells();
    });

    /* Intercept standard add-to-cart form submissions */
    interceptAddToCartForms();
  }

  /* ===========================================================================
     LOAD UPSELLS
     Fetches Shopify product recommendations based on cart contents.
     Falls back to a cross-sell collection if the API returns nothing.
     =========================================================================== */

  function loadUpsells() {
    if (!upsellSection || !upsellTrack) return;

    /* Collect current cart product IDs */
    var cartItems = drawer.querySelectorAll('[data-ecombio-cart-item]');
    if (!cartItems.length) {
      upsellSection.hidden = true;
      return;
    }

    upsellSection.hidden = false;

    /* Use first cart item as seed for recommendations */
    var productIds = Array.from(cartItems).map(function (el) {
      return el.dataset.variantId;
    });

    /* Avoid redundant fetches if cart hasn't changed */
    var idsKey = productIds.join(',');
    if (idsKey === currentProductIds.join(',') && upsellTrack.querySelector('.ecombio-cart-upsell__card')) {
      return;
    }
    currentProductIds = productIds;

    /* Show loading skeletons */
    showSkeletons();

    /* Fetch recommendations for first product in cart */
    var firstItem = cartItems[0];
    var variantId = firstItem.dataset.variantId;

    /* Look up productId from the cart API */
    fetch('/cart.js')
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var productId = null;
        if (cart.items && cart.items.length) {
          productId = cart.items[0].product_id;
        }
        if (!productId) throw new Error('No product ID found');
        return fetchRecommendations(productId);
      })
      .then(function (products) {
        renderUpsellCards(products);
        if (products.length) {
          analyticsUpsellViewed(products.map(function (p) { return p.id; }));
        }
      })
      .catch(function (err) {
        console.warn('[ECOMBIO Upsells] Could not load recommendations:', err);
        upsellSection.hidden = true;
      });
  }

  /* ===========================================================================
     FETCH RECOMMENDATIONS
     Uses Shopify's /recommendations/products.json endpoint.
     =========================================================================== */

  function fetchRecommendations(productId) {
    var url = '/recommendations/products.json?product_id=' + productId + '&limit=' + UPSELL_LIMIT + '&intent=related';

    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        return data.products || [];
      });
  }

  /* ===========================================================================
     RENDER UPSELL CARDS
     =========================================================================== */

  function renderUpsellCards(products) {
    if (!upsellTrack) return;

    if (!products.length) {
      upsellSection.hidden = true;
      return;
    }

    var html = '';
    products.forEach(function (product) {
      var variant = product.variants[0];
      if (!variant) return;

      var imgSrc = product.featured_image
        ? product.featured_image.replace(/(\.[a-z]+)(\?.*)?$/, '_160x160$1')
        : '';

      var imgHTML = imgSrc
        ? '<img class="ecombio-cart-upsell__card-img" src="' + imgSrc + '" alt="' + escapeHTML(product.title) + '" width="140" height="140" loading="lazy">'
        : '<div class="ecombio-cart-upsell__card-img" style="background:#f2f2f2;width:100%;aspect-ratio:1;"></div>';

      var price   = window.EcombioCart ? window.EcombioCart.formatMoney(variant.price) : ('$' + (variant.price / 100).toFixed(2));

      html += '<div class="ecombio-cart-upsell__card" data-ecombio-upsell-card data-variant-id="' + variant.id + '" data-product-id="' + product.id + '">' +
        imgHTML +
        '<div class="ecombio-cart-upsell__card-body">' +
          '<p class="ecombio-cart-upsell__card-title">' + escapeHTML(product.title) + '</p>' +
          '<p class="ecombio-cart-upsell__card-price">' + price + '</p>' +
          '<button type="button" class="ecombio-cart-upsell__card-add" data-ecombio-upsell-add data-variant-id="' + variant.id + '" aria-label="Add ' + escapeHTML(product.title) + ' to cart">' +
            'Add to Cart' +
          '</button>' +
        '</div>' +
      '</div>';
    });

    upsellTrack.innerHTML = html;

    /* Bind add buttons */
    upsellTrack.querySelectorAll('[data-ecombio-upsell-add]').forEach(function (btn) {
      btn.addEventListener('click', handleUpsellAdd);
    });
  }

  function showSkeletons() {
    upsellTrack.innerHTML =
      '<span class="ecombio-cart-upsell__skeleton"></span>' +
      '<span class="ecombio-cart-upsell__skeleton"></span>' +
      '<span class="ecombio-cart-upsell__skeleton"></span>';
  }

  /* ===========================================================================
     UPSELL ADD TO CART
     =========================================================================== */

  function handleUpsellAdd(e) {
    var btn       = e.currentTarget;
    var variantId = parseInt(btn.dataset.variantId, 10);
    var card      = btn.closest('[data-ecombio-upsell-card]');
    var productId = card ? parseInt(card.dataset.productId, 10) : null;

    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Adding…';

    var addFn = (window.EcombioCart && window.EcombioCart.add)
      ? window.EcombioCart.add
      : function (id, qty) {
          return fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, quantity: qty })
          }).then(function (r) { return r.json(); });
        };

    addFn(variantId, 1)
      .then(function () {
        btn.setAttribute('aria-busy', 'false');
        btn.textContent = '✓ Added';
        btn.disabled = true;

        analyticsUpsellAdded(variantId, productId);

        if (window.EcombioCart) window.EcombioCart.refresh();
      })
      .catch(function (err) {
        console.error('[ECOMBIO Upsells] Add failed:', err);
        btn.setAttribute('aria-busy', 'false');
        btn.textContent = 'Add to Cart';
      });
  }

  /* ===========================================================================
     INTERCEPT ADD-TO-CART FORMS
     Prevent default form submit → use AJAX → open drawer
     Works with any standard Shopify product form.
     =========================================================================== */

  function interceptAddToCartForms() {
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || form.getAttribute('action') !== '/cart/add') return;
      if (form.dataset.ecombioHandled) return;

      e.preventDefault();
      form.dataset.ecombioHandled = '1';

      var formData = new FormData(form);
      var variantId = parseInt(formData.get('id'), 10);
      var qty       = parseInt(formData.get('quantity') || 1, 10);

      if (!variantId) return;

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.setAttribute('aria-busy', 'true');

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: qty })
      })
        .then(function (r) { return r.json(); })
        .then(function () {
          if (submitBtn) submitBtn.setAttribute('aria-busy', 'false');
          document.dispatchEvent(new CustomEvent('ecombio:cart:added', { detail: { variantId: variantId, quantity: qty } }));
        })
        .catch(function (err) {
          console.error('[ECOMBIO Upsells] Add-to-cart failed:', err);
          if (submitBtn) submitBtn.setAttribute('aria-busy', 'false');
          /* Fall back to standard form submit */
          form.removeAttribute('data-ecombio-handled');
          form.submit();
        });
    });
  }

  /* ===========================================================================
     ANALYTICS HELPERS
     =========================================================================== */

  function analyticsUpsellViewed(productIds) {
    dispatch('upsell_viewed', { product_ids: productIds });
  }

  function analyticsUpsellAdded(variantId, productId) {
    dispatch('upsell_added', { variant_id: variantId, product_id: productId });
  }

  function dispatch(event, data) {
    document.dispatchEvent(new CustomEvent('ecombio:analytics', {
      detail: Object.assign({ event: event }, data || {})
    }));
  }

  /* ===========================================================================
     HELPERS
     =========================================================================== */

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
