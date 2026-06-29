/**
 * header-cart.js
 * Cart icon behaviour for sections/main-header.liquid.
 *
 * Responsibilities:
 *   1. Click → dispatch 'cart:open' (cart-drawer.js opens the drawer)
 *   2. 'cart:updated' → update badge count + aria-label
 *   3. 'cart:drawer:open' / 'cart:drawer:close' → sync aria-expanded
 *
 * Dependencies:
 *   snippets/header-cart.liquid  — provides #main-header-cart-toggle
 *                                  and [data-cart-count]
 *   assets/cart-drawer.js        — listens for 'cart:open',
 *                                  dispatches 'cart:drawer:open'
 *
 * Badge format convention (SOURCE OF TRUTH — must match cart-drawer.js
 * updateCountBadges): badges always render as "(N)".
 *
 * No global variables. Wraps everything in an IIFE to stay side-effect-free.
 */

(function () {
  'use strict';

  /* ── Selectors ──────────────────────────────────────────────────────────── */

  const TOGGLE_ID  = 'main-header-cart-toggle';
  const COUNT_SEL  = '[data-cart-count]';
  const HIDDEN_CLS = 'main-header__cart-badge--hidden';
  const POP_CLS    = 'main-header__cart-badge--pop';

  /* ── Element refs (resolved after DOMContentLoaded) ─────────────────────── */

  let cartBtn = null;

  /* ── Helpers ────────────────────────────────────────────────────────────── */

  /**
   * Update every [data-cart-count] badge in the document.
   * Always renders as "(N)" — matches cart-drawer.js's updateCountBadges
   * so badge text doesn't flip-flop depending on which module last updated it.
   *
   * @param {number} count
   */
  function updateBadges(count) {
    document.querySelectorAll(COUNT_SEL).forEach(function (el) {
      el.textContent = '(' + count + ')';
      el.classList.toggle(HIDDEN_CLS, count === 0);

      /* Pop micro-animation on increase */
      if (count > 0) {
        el.classList.remove(POP_CLS);
        /* Force reflow so the animation restarts even if already applied */
        void el.offsetWidth;
        el.classList.add(POP_CLS);
        el.addEventListener(
          'animationend',
          function () { el.classList.remove(POP_CLS); },
          { once: true }
        );
      }
    });
  }

  /**
   * Sync the button's aria-label to reflect the current count.
   *
   * @param {number} count
   */
  function updateAriaLabel(count) {
    if (!cartBtn) return;
    var noun = count === 1 ? 'item' : 'items';
    cartBtn.setAttribute('aria-label', 'Open cart, ' + count + ' ' + noun);
  }

  /* ── Init ───────────────────────────────────────────────────────────────── */

  function init() {
    cartBtn = document.getElementById(TOGGLE_ID);
    if (!cartBtn) return; /* not on a page that includes the cart icon */

    /* 1. Click → open drawer via event (cart-drawer.js owns the open logic) */
    cartBtn.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('cart:open', { bubbles: true }));
    });

    /* 2. Badge + label sync when cart contents change */
    document.addEventListener('cart:updated', function (e) {
      var count = (e.detail && e.detail.itemCount != null)
        ? e.detail.itemCount
        : (e.detail && e.detail.count != null)
          ? e.detail.count
          : null;

      if (count === null) return;
      updateBadges(count);
      updateAriaLabel(count);
    });

    /* 3. aria-expanded mirrors drawer open/close state */
    document.addEventListener('cart:drawer:open', function () {
      if (cartBtn) cartBtn.setAttribute('aria-expanded', 'true');
    });

    /* cart-drawer.js dispatches 'cart:drawer:close' on close — graceful
       no-op if the current cart-drawer version doesn't emit it yet. */
    document.addEventListener('cart:drawer:close', function () {
      if (cartBtn) cartBtn.setAttribute('aria-expanded', 'false');
    });

    /* Also reset aria-expanded if the user presses Escape or clicks outside
       (cart-drawer.js closes silently in those cases without an event). */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && cartBtn) {
        cartBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Run after DOM is ready. The script tag in main-header.liquid uses `defer`,
     so DOMContentLoaded has already fired in most browsers — guard either way. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());