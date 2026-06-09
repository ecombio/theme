/* =============================================================================
   ECOMBIO Cart JS  |  assets/ecombio-cart.js
   Handles:
     1. Cart Drawer open / close / focus-trap
     2. Shopify AJAX Cart API: GET cart state, change qty, remove, add
     3. Badge + summary dynamic update (no page reload)
     4. Free shipping progress bar update
     5. Auto-open drawer on add-to-cart events (dispatched by theme or
        ecombio-cart-upsells.js using CustomEvent 'ecombio:cart:open')
     6. Analytics event dispatching
   ============================================================================= */

(function () {
  'use strict';

  /* ── Constants ── */
  var DRAWER_OPEN_CLASS = 'is-open';
  var LOADING_CLASS     = 'ecombio-cart-item--loading';

  /* ── Cached DOM references (set in init) ── */
  var drawer, overlay, panel, closeButtons, triggers,
      cartItemsEl, cartFooterEl, cartEmptyEl,
      progressFillEl, progressMsgEl, progressSection,
      countBadges, countLabels, subtotalEl;

  /* ── State ── */
  var isOpen          = false;
  var freeShipCents   = 0;
  var checkoutUrl     = '/cart';
  var focusableSelector = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  /* ===========================================================================
     INIT
     =========================================================================== */

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    drawer = document.getElementById('ecombio-cart-drawer');
    if (!drawer) return;

    overlay     = drawer.querySelector('[data-ecombio-cart-overlay]');
    panel       = drawer.querySelector('.ecombio-cart-drawer__panel');
    cartItemsEl = drawer.querySelector('[data-ecombio-cart-items]');
    cartFooterEl = drawer.querySelector('[data-ecombio-cart-footer]');
    progressFillEl   = drawer.querySelector('[data-ecombio-progress-fill]');
    progressMsgEl    = drawer.querySelector('[data-ecombio-progress-message]');
    progressSection  = drawer.querySelector('[data-ecombio-cart-progress]');
    subtotalEl  = drawer.querySelector('[data-ecombio-subtotal]');

    /* Read config from data attributes set by Liquid */
    freeShipCents = parseInt(drawer.dataset.freeShippingThreshold || 0, 10);
    checkoutUrl   = drawer.dataset.checkoutUrl || '/cart';

    /* All badge spans (there may be multiple: desktop + mobile) */
    countBadges = document.querySelectorAll('[data-ecombio-cart-count]');
    countLabels = document.querySelectorAll('[data-ecombio-cart-count-label]');

    /* Close buttons (all elements with data-ecombio-cart-close) */
    closeButtons = document.querySelectorAll('[data-ecombio-cart-close]');
    closeButtons.forEach(function (btn) {
      btn.addEventListener('click', closeDrawer);
    });

    /* Open triggers (cart icon button) */
    triggers = document.querySelectorAll('[data-ecombio-cart-trigger]');
    triggers.forEach(function (btn) {
      btn.addEventListener('click', openDrawer);
    });

    /* Overlay click closes */
    if (overlay) overlay.addEventListener('click', closeDrawer);

    /* Escape key */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closeDrawer();
    });

    /* Quantity controls (delegated, re-bound after each render) */
    if (cartItemsEl) {
      cartItemsEl.addEventListener('click', handleQtyClick);
      cartItemsEl.addEventListener('change', handleQtyInputChange);
    }

    /* Listen for external open events (e.g. from upsells JS or add-to-cart forms) */
    document.addEventListener('ecombio:cart:open', function (e) {
      refreshCart().then(function () { openDrawer(); });
    });

    /* Also intercept standard Shopify add-to-cart form submissions if not
       already handled by ecombio-cart-upsells.js */
    document.addEventListener('ecombio:cart:added', function () {
      refreshCart().then(function () { openDrawer(); });
    });

    /* Checkout link analytics */
    var checkoutBtn = drawer.querySelector('[data-ecombio-checkout]');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', function () {
        analytics('cart_drawer_checkout_click');
      });
    }
  }

  /* ===========================================================================
     DRAWER OPEN / CLOSE
     =========================================================================== */

  function openDrawer() {
    if (isOpen) return;
    isOpen = true;

    drawer.classList.add(DRAWER_OPEN_CLASS);
    drawer.setAttribute('aria-hidden', 'false');
    triggers.forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
    document.body.style.overflow = 'hidden';

    /* Focus first focusable element inside panel */
    requestAnimationFrame(function () {
      var firstFocusable = panel.querySelector(focusableSelector);
      if (firstFocusable) firstFocusable.focus();
    });

    /* Focus trap */
    panel.addEventListener('keydown', trapFocus);

    analytics('cart_drawer_open');
  }

  function closeDrawer() {
    if (!isOpen) return;
    isOpen = false;

    drawer.classList.remove(DRAWER_OPEN_CLASS);
    drawer.setAttribute('aria-hidden', 'true');
    triggers.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
    document.body.style.overflow = '';
    panel.removeEventListener('keydown', trapFocus);

    /* Return focus to the trigger that opened the drawer */
    if (triggers[0]) triggers[0].focus();

    analytics('cart_drawer_close');
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    var focusable = Array.from(panel.querySelectorAll(focusableSelector));
    if (!focusable.length) return;

    var first = focusable[0];
    var last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* ===========================================================================
     SHOPIFY AJAX CART API
     =========================================================================== */

  /**
   * GET /cart.js — fetch full cart state
   * @returns {Promise<Object>} cart JSON
   */
  function getCart() {
    return fetch('/cart.js', { headers: { 'Content-Type': 'application/json' } })
      .then(function (r) { return r.json(); });
  }

  /**
   * POST /cart/change.js — update a line item quantity
   * @param {Number} line  1-based line index
   * @param {Number} qty   new quantity (0 to remove)
   * @returns {Promise<Object>} updated cart
   */
  function cartChange(line, qty) {
    return fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line: line, quantity: qty })
    }).then(function (r) { return r.json(); });
  }

  /**
   * POST /cart/add.js — add a variant to cart
   * @param {Number} variantId
   * @param {Number} quantity
   * @param {Object} [properties]
   * @returns {Promise<Object>} added item
   */
  function cartAdd(variantId, quantity, properties) {
    var payload = { id: variantId, quantity: quantity || 1 };
    if (properties) payload.properties = properties;

    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  /* ===========================================================================
     REFRESH — fetch cart and update all DOM sections
     =========================================================================== */

  function refreshCart() {
    return getCart().then(function (cart) {
      updateBadges(cart.item_count);
      updateProgress(cart.total_price);
      renderCartItems(cart);
      renderCartSummary(cart);
      return cart;
    });
  }

  /* ===========================================================================
     BADGE UPDATE
     =========================================================================== */

  function updateBadges(count) {
    countBadges.forEach(function (el) {
      el.textContent = count;
      el.classList.toggle('ecombio-header__cart-badge--hidden', count === 0);
    });
    countLabels.forEach(function (el) {
      el.textContent = '(' + count + ' ' + (count === 1 ? 'item' : 'items') + ')';
    });

    /* Aria label on trigger buttons */
    triggers.forEach(function (btn) {
      btn.setAttribute('aria-label', 'Open cart, ' + count + ' ' + (count === 1 ? 'item' : 'items'));
    });
  }

  /* ===========================================================================
     PROGRESS BAR UPDATE
     =========================================================================== */

  function updateProgress(totalPriceCents) {
    if (!progressSection || !freeShipCents) return;

    var remaining   = freeShipCents - totalPriceCents;
    var pct         = Math.min(100, Math.round((totalPriceCents / freeShipCents) * 100));
    var shippingNote = drawer.querySelector('.ecombio-cart-summary__shipping-note');

    if (progressFillEl) progressFillEl.style.width = pct + '%';

    if (progressMsgEl) {
      if (remaining <= 0) {
        progressMsgEl.innerHTML = '🎉 You\'ve unlocked free shipping!';
        progressMsgEl.classList.add('ecombio-cart-progress__message--achieved');
        if (shippingNote) shippingNote.textContent = '✓ Free shipping applied';
      } else {
        var dollars = (remaining / 100).toFixed(2);
        progressMsgEl.innerHTML = 'You\'re <strong>$' + dollars + '</strong> away from free shipping';
        progressMsgEl.classList.remove('ecombio-cart-progress__message--achieved');
        if (shippingNote) shippingNote.textContent = 'Shipping & taxes calculated at checkout';
      }
    }
  }

  /* ===========================================================================
     RENDER — CART ITEMS
     Re-renders the full items list from a cart JSON object.
     =========================================================================== */

  function renderCartItems(cart) {
    if (!cartItemsEl) return;

    if (cart.item_count === 0) {
      cartItemsEl.innerHTML = buildEmptyHTML();
      if (cartFooterEl) cartFooterEl.style.display = 'none';

      /* Re-bind close on newly rendered "Continue Shopping" btn */
      var newClose = cartItemsEl.querySelector('[data-ecombio-cart-close]');
      if (newClose) newClose.addEventListener('click', closeDrawer);
      return;
    }

    if (cartFooterEl) cartFooterEl.style.display = '';

    var html = '';
    cart.items.forEach(function (item, idx) {
      html += buildItemHTML(item, idx + 1);
    });

    cartItemsEl.innerHTML = html;
  }

  function buildEmptyHTML() {
    return '<div class="ecombio-cart-empty" data-ecombio-cart-empty>' +
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">' +
      '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>' +
      '<line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' +
      '<p>Your cart is empty.</p>' +
      '<button type="button" class="ecombio-cart-btn ecombio-cart-btn--secondary" data-ecombio-cart-close>Continue Shopping</button>' +
      '</div>';
  }

  function buildItemHTML(item, lineIdx) {
    var imgSrc  = item.image ? item.image.replace(/(\.[a-z]+)$/, '_160x160$1') : '';
    var imgHTML = imgSrc
      ? '<img class="ecombio-cart-item__img" src="' + imgSrc + '" alt="" width="80" height="80" loading="lazy">'
      : '<div class="ecombio-cart-item__img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div>';

    var variantHTML = (item.variant_title && item.variant_title !== 'Default Title')
      ? '<p class="ecombio-cart-item__variant">' + escapeHTML(item.variant_title) + '</p>'
      : '';

    var sellingPlanHTML = item.selling_plan_allocation
      ? '<p class="ecombio-cart-item__selling-plan">' + escapeHTML(item.selling_plan_allocation.selling_plan.name) + '</p>'
      : '';

    var originalPrice = item.original_line_price;
    var finalPrice    = item.final_line_price;
    var compareHTML   = (originalPrice !== finalPrice)
      ? '<span class="ecombio-cart-item__price--compare">' + formatMoney(originalPrice) + '</span>'
      : '';

    var discountHTML = '';
    if (item.line_level_discount_allocations && item.line_level_discount_allocations.length) {
      item.line_level_discount_allocations.forEach(function (d) {
        discountHTML += '<span class="ecombio-cart-item__discount-badge">' + escapeHTML(d.discount_application.title) + '</span>';
      });
    }

    return '<div class="ecombio-cart-item" data-ecombio-cart-item data-line="' + lineIdx + '" data-variant-id="' + item.variant_id + '">' +
      '<a href="' + item.url + '" class="ecombio-cart-item__img-wrap" tabindex="-1" aria-hidden="true">' + imgHTML + '</a>' +
      '<div class="ecombio-cart-item__details">' +
        '<a href="' + item.url + '" class="ecombio-cart-item__title">' + escapeHTML(item.product_title) + '</a>' +
        variantHTML +
        sellingPlanHTML +
        '<div class="ecombio-cart-item__price-row">' +
          '<span class="ecombio-cart-item__price">' + compareHTML + formatMoney(finalPrice) + '</span>' +
          discountHTML +
        '</div>' +
        '<div class="ecombio-cart-item__controls">' +
          '<div class="ecombio-cart-qty" role="group" aria-label="Quantity for ' + escapeHTML(item.product_title) + '">' +
            '<button type="button" class="ecombio-cart-qty__btn" aria-label="Decrease quantity" data-ecombio-qty-dec data-line="' + lineIdx + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            '</button>' +
            '<input type="number" class="ecombio-cart-qty__input" value="' + item.quantity + '" min="0" aria-label="Quantity" data-ecombio-qty-input data-line="' + lineIdx + '">' +
            '<button type="button" class="ecombio-cart-qty__btn" aria-label="Increase quantity" data-ecombio-qty-inc data-line="' + lineIdx + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            '</button>' +
          '</div>' +
          '<button type="button" class="ecombio-cart-item__remove" aria-label="Remove ' + escapeHTML(item.product_title) + '" data-ecombio-remove data-line="' + lineIdx + '">Remove</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ===========================================================================
     RENDER — CART SUMMARY
     =========================================================================== */

  function renderCartSummary(cart) {
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price);

    /* Savings line */
    var savings = 0;
    cart.items.forEach(function (item) {
      savings += item.original_line_price - item.final_line_price;
    });
    var savingsEl = drawer.querySelector('[data-ecombio-savings]');
    if (savingsEl) {
      if (savings > 0) {
        savingsEl.style.display = '';
        var savingsAmount = savingsEl.querySelector('span:last-child');
        if (savingsAmount) savingsAmount.textContent = formatMoney(savings);
      } else {
        savingsEl.style.display = 'none';
      }
    }
  }

  /* ===========================================================================
     QTY CONTROLS — delegated event handlers
     =========================================================================== */

  function handleQtyClick(e) {
    var dec = e.target.closest('[data-ecombio-qty-dec]');
    var inc = e.target.closest('[data-ecombio-qty-inc]');
    var rem = e.target.closest('[data-ecombio-remove]');

    if (dec) {
      var line = parseInt(dec.dataset.line, 10);
      var input = cartItemsEl.querySelector('[data-ecombio-qty-input][data-line="' + line + '"]');
      var qty = Math.max(0, parseInt(input.value, 10) - 1);
      updateLineQty(line, qty, dec.closest('[data-ecombio-cart-item]'));
    } else if (inc) {
      var line = parseInt(inc.dataset.line, 10);
      var input = cartItemsEl.querySelector('[data-ecombio-qty-input][data-line="' + line + '"]');
      var qty = parseInt(input.value, 10) + 1;
      updateLineQty(line, qty, inc.closest('[data-ecombio-cart-item]'));
    } else if (rem) {
      var line = parseInt(rem.dataset.line, 10);
      updateLineQty(line, 0, rem.closest('[data-ecombio-cart-item]'));
    }
  }

  function handleQtyInputChange(e) {
    var input = e.target.closest('[data-ecombio-qty-input]');
    if (!input) return;
    var line = parseInt(input.dataset.line, 10);
    var qty  = Math.max(0, parseInt(input.value, 10) || 0);
    updateLineQty(line, qty, input.closest('[data-ecombio-cart-item]'));
  }

  function updateLineQty(line, qty, itemEl) {
    if (itemEl) itemEl.classList.add(LOADING_CLASS);

    cartChange(line, qty)
      .then(function (cart) {
        updateBadges(cart.item_count);
        updateProgress(cart.total_price);
        renderCartItems(cart);
        renderCartSummary(cart);

        /* Notify upsells module so it can refresh */
        document.dispatchEvent(new CustomEvent('ecombio:cart:updated', { detail: cart }));
      })
      .catch(function (err) {
        console.error('[ECOMBIO Cart] Change failed:', err);
        if (itemEl) itemEl.classList.remove(LOADING_CLASS);
      });
  }

  /* ===========================================================================
     PUBLIC API — exposed for ecombio-cart-upsells.js
     =========================================================================== */

  window.EcombioCart = {
    open:       openDrawer,
    close:      closeDrawer,
    add:        cartAdd,
    refresh:    refreshCart,
    formatMoney: formatMoney
  };

  /* ===========================================================================
     HELPERS
     =========================================================================== */

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ===========================================================================
     ANALYTICS
     Dispatches a CustomEvent. Integrate with GTM dataLayer or analytics SDK.
     =========================================================================== */

  function analytics(event, data) {
    document.dispatchEvent(new CustomEvent('ecombio:analytics', {
      detail: Object.assign({ event: event }, data || {})
    }));

    /* GTM dataLayer push (uncomment if GTM is installed) */
    /*
    if (window.dataLayer) {
      window.dataLayer.push({ event: 'ecombio_' + event });
    }
    */
  }

})();
