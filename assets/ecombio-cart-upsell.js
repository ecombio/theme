/**
 * ecombio-cart-upsell.js
 * ECOMBIO Cart Upsell Page
 * Responsibilities: AJAX cart updates, add/remove offers, cart refresh,
 * checkout routing, analytics dispatching.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────── */
  const SELECTORS = {
    root: '[data-ecombio-cart-upsell]',
    cartItems: '[data-ecombio-cart-items]',
    subtotal: '[data-ecombio-subtotal]',
    savings: '[data-ecombio-savings]',
    total: '[data-ecombio-total]',
    shippingBar: '[data-ecombio-shipping-bar]',
    shippingMessage: '[data-ecombio-shipping-message]',
    shippingFill: '[data-ecombio-shipping-fill]',
    shippingRemaining: '[data-ecombio-shipping-remaining]',
    offerCard: '[data-ecombio-offer]',
    addOffer: '[data-ecombio-add-offer]',
    addBundle: '[data-ecombio-add-bundle]',
    checkoutAccept: '[data-ecombio-checkout-accept]',
    checkoutSkip: '[data-ecombio-checkout-skip]',
  };

  const ROUTES = {
    cart: '/cart.js',
    add: '/cart/add.js',
    change: '/cart/change.js',
    update: '/cart/update.js',
    checkout: '/checkout',
  };

  const EVENTS = {
    PAGE_VIEWED: 'ecombio:page_viewed',
    OFFER_VIEWED: 'ecombio:offer_viewed',
    OFFER_ADDED: 'ecombio:offer_added',
    OFFER_REMOVED: 'ecombio:offer_removed',
    OFFER_ACCEPTED: 'ecombio:offer_accepted',
    OFFER_REJECTED: 'ecombio:offer_rejected',
    CHECKOUT_STARTED: 'ecombio:checkout_started',
  };

  /* ─────────────────────────────────────────────
     ANALYTICS
  ───────────────────────────────────────────── */
  function dispatch(eventName, detail = {}) {
    const event = new CustomEvent(eventName, {
      bubbles: true,
      detail: { ...detail, timestamp: Date.now() },
    });
    document.dispatchEvent(event);
    // Also push to dataLayer if present (GTM compatibility)
    if (window.dataLayer) {
      window.dataLayer.push({ event: eventName, ...detail });
    }
  }

  /* ─────────────────────────────────────────────
     AJAX HELPERS
  ───────────────────────────────────────────── */
  async function fetchCart() {
    const res = await fetch(ROUTES.cart, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Cart fetch failed');
    return res.json();
  }

  async function addToCart(items) {
    const res = await fetch(ROUTES.add, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.description || 'Add to cart failed');
    }
    return res.json();
  }

  async function changeLineItem(id, quantity) {
    const res = await fetch(ROUTES.change, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, quantity }),
    });
    if (!res.ok) throw new Error('Cart change failed');
    return res.json();
  }

  /* ─────────────────────────────────────────────
     MONEY FORMATTING
  ───────────────────────────────────────────── */
  function formatMoney(cents) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: window.Shopify?.currency?.active || 'USD',
    }).format(cents / 100);
  }

  /* ─────────────────────────────────────────────
     CART SUMMARY REFRESH
  ───────────────────────────────────────────── */
  async function refreshCartSummary() {
    const root = document.querySelector(SELECTORS.root);
    if (!root) return;

    const cart = await fetchCart();

    // Update subtotal
    const subtotalEl = root.querySelector(SELECTORS.subtotal);
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.original_total_price);

    // Update savings
    const savingsEl = root.querySelector(SELECTORS.savings);
    if (savingsEl) {
      if (cart.total_discount > 0) {
        savingsEl.textContent = '-' + formatMoney(cart.total_discount);
        savingsEl.closest('.ecombio-upsell__totals-row')?.removeAttribute('hidden');
      } else {
        savingsEl.closest('.ecombio-upsell__totals-row')?.setAttribute('hidden', '');
      }
    }

    // Update total
    const totalEl = root.querySelector(SELECTORS.total);
    if (totalEl) totalEl.textContent = formatMoney(cart.total_price);

    // Update shipping bar
    updateShippingBar(root, cart);

    return cart;
  }

  function updateShippingBar(root, cart) {
    const threshold = parseInt(root.dataset.ecombioFreeShippingThreshold, 10) || 0;
    if (!threshold) return;

    const fill = root.querySelector(SELECTORS.shippingFill);
    const message = root.querySelector(SELECTORS.shippingMessage);
    const remaining = root.querySelector(SELECTORS.shippingRemaining);
    const bar = root.querySelector(SELECTORS.shippingBar);
    if (!bar) return;

    const subtotal = cart.total_price;
    const progress = Math.min((subtotal / threshold) * 100, 100);
    const remainingCents = Math.max(threshold - subtotal, 0);

    if (fill) {
      fill.style.width = progress + '%';
      fill.closest('[role="progressbar"]')?.setAttribute('aria-valuenow', Math.round(progress));
    }

    if (message) {
      if (remainingCents <= 0) {
        message.classList.add('ecombio-upsell__shipping-bar-message--achieved');
        message.innerHTML = "🎉 You've unlocked free shipping!";
      } else {
        message.classList.remove('ecombio-upsell__shipping-bar-message--achieved');
        if (remaining) {
          remaining.textContent = formatMoney(remainingCents);
        } else {
          message.textContent = `You are ${formatMoney(remainingCents)} away from free shipping`;
        }
      }
    }
  }

  /* ─────────────────────────────────────────────
     OFFER BUTTON STATE
  ───────────────────────────────────────────── */
  function setButtonState(btn, state) {
    // state: 'default' | 'loading' | 'added' | 'error'
    btn.dataset.state = state;
    btn.disabled = state === 'loading';

    const card = btn.closest(SELECTORS.offerCard);
    if (card) card.dataset.state = state;
  }

  /* ─────────────────────────────────────────────
     ADD SINGLE OFFER
  ───────────────────────────────────────────── */
  async function handleAddOffer(btn) {
    const variantId = btn.dataset.variantId;
    const sellingPlanId = btn.dataset.sellingPlanId;
    const offerLabel = btn.dataset.offerLabel || 'offer';
    if (!variantId) return;

    setButtonState(btn, 'loading');

    const item = { id: parseInt(variantId, 10), quantity: 1 };
    if (sellingPlanId) item.selling_plan = parseInt(sellingPlanId, 10);

    try {
      await addToCart([item]);
      setButtonState(btn, 'added');
      dispatch(EVENTS.OFFER_ADDED, { variantId, offerLabel, sellingPlanId });
      await refreshCartSummary();
    } catch (err) {
      setButtonState(btn, 'default');
      console.error('[ECOMBIO] Add offer error:', err);
    }
  }

  /* ─────────────────────────────────────────────
     ADD BUNDLE
  ───────────────────────────────────────────── */
  async function handleAddBundle(btn) {
    let variantIds;
    try {
      variantIds = JSON.parse(btn.dataset.variantIds || '[]').filter(Boolean);
    } catch {
      return;
    }
    if (!variantIds.length) return;

    setButtonState(btn, 'loading');

    const items = variantIds.map((id) => ({ id: parseInt(id, 10), quantity: 1 }));

    try {
      await addToCart(items);
      setButtonState(btn, 'added');
      dispatch(EVENTS.OFFER_ADDED, { offerType: 'bundle', variantIds });
      await refreshCartSummary();
    } catch (err) {
      setButtonState(btn, 'default');
      console.error('[ECOMBIO] Add bundle error:', err);
    }
  }

  /* ─────────────────────────────────────────────
     CHECKOUT ROUTING
  ───────────────────────────────────────────── */
  function proceedToCheckout(accepted) {
    dispatch(EVENTS.CHECKOUT_STARTED, { accepted });
    if (accepted) {
      dispatch(EVENTS.OFFER_ACCEPTED);
    } else {
      dispatch(EVENTS.OFFER_REJECTED);
    }
    window.location.href = ROUTES.checkout;
  }

  /* ─────────────────────────────────────────────
     INTERSECTION OBSERVER — OFFER VIEWED
  ───────────────────────────────────────────── */
  function observeOfferCards() {
    if (!window.IntersectionObserver) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target;
            const variantId = card.dataset.variantId;
            const offerType = card.dataset.offerType;
            dispatch(EVENTS.OFFER_VIEWED, { variantId, offerType });
            observer.unobserve(card);
          }
        });
      },
      { threshold: 0.5 }
    );

    document.querySelectorAll(SELECTORS.offerCard).forEach((card) => observer.observe(card));
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  function init() {
    const root = document.querySelector(SELECTORS.root);
    if (!root) return;

    // Add single offer buttons
    root.querySelectorAll(SELECTORS.addOffer).forEach((btn) => {
      btn.addEventListener('click', () => handleAddOffer(btn));
    });

    // Add bundle buttons
    root.querySelectorAll(SELECTORS.addBundle).forEach((btn) => {
      btn.addEventListener('click', () => handleAddBundle(btn));
    });

    // Primary CTA — accept offers & checkout
    root.querySelector(SELECTORS.checkoutAccept)?.addEventListener('click', () => {
      proceedToCheckout(true);
    });

    // Secondary CTA — skip to checkout
    root.querySelector(SELECTORS.checkoutSkip)?.addEventListener('click', () => {
      proceedToCheckout(false);
    });

    // Observe offers for analytics
    observeOfferCards();

    // Fire page viewed event
    dispatch(EVENTS.PAGE_VIEWED, { url: window.location.href });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
