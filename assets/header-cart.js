/**
 * header-cart.js
 *
 * Manages the cart trigger → cart drawer interaction, and keeps the
 * badge count in sync after Ajax add-to-cart events.
 *
 * CONTRACT (data attributes):
 *   [data-cart-trigger]   <a> in snippets/header-cart.liquid
 *   [data-cart-drawer]    drawer shell, wherever it lives in the DOM
 *   [data-cart-count]     <span> inside the trigger that holds the number
 *
 * CUSTOM EVENTS LISTENED TO:
 *   cart:open             — opens the drawer (fired by product-card.js etc.)
 *   cart:updated          — payload: { itemCount: Number }
 *                           updates the badge without a page reload
 *
 * PROGRESSIVE ENHANCEMENT:
 *   If no [data-cart-drawer] exists, the <a> follows its href="/cart" normally.
 */

(function () {
  'use strict';

  const trigger = document.querySelector('[data-cart-trigger]');
  const drawer  = document.querySelector('[data-cart-drawer]');
  const badge   = document.querySelector('[data-cart-count]');

  // ── BADGE UPDATE ───────────────────────────────────────────────────────────
  //
  // Called after any Ajax cart mutation. Updates the visible count and
  // the aria-label on the trigger so screen readers get the new total.

  function updateBadge(count) {
    if (!trigger) return;

    const label = count > 0
      ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}`
      : 'Cart';

    trigger.setAttribute('aria-label', label);

    if (count > 0) {
      if (badge) {
        badge.textContent = count;
      } else {
        // Badge span wasn't in the DOM (cart was empty on page load) — create it.
        const wrap    = trigger.querySelector('.header__cart-icon-wrap');
        const newBadge = document.createElement('span');
        newBadge.className      = 'header__cart-badge';
        newBadge.dataset.cartCount = '';
        newBadge.textContent    = count;
        if (wrap) wrap.appendChild(newBadge);
      }
    } else {
      // Cart is now empty — remove the badge entirely.
      const existingBadge = trigger.querySelector('[data-cart-count]');
      if (existingBadge) existingBadge.remove();
    }
  }

  // Sync badge on cart:updated (fired by cart-drawer.js after fetch)
  document.addEventListener('cart:updated', function (e) {
    if (e.detail && typeof e.detail.itemCount === 'number') {
      updateBadge(e.detail.itemCount);
    }
  });


  // ── DRAWER INTERACTION ─────────────────────────────────────────────────────
  //
  // Only wired up when a [data-cart-drawer] exists in the DOM.
  // Falls back to plain href="/cart" navigation otherwise.

  if (!trigger || !drawer) return;

  function isOpen() {
    return drawer.hidden === false;
  }

  function openDrawer() {
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    document.dispatchEvent(new CustomEvent('cart:open'));

    const firstFocusable = drawer.querySelector(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) firstFocusable.focus();
  }

  function closeDrawer() {
    drawer.hidden = true;
    drawer.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function toggleDrawer() {
    isOpen() ? closeDrawer() : openDrawer();
  }

  closeDrawer(); // ensure correct initial state

  trigger.addEventListener('click', function (e) {
    e.preventDefault();
    toggleDrawer();
  });

  // Open from anywhere (e.g. product-card.js fires cart:open after ATC)
  document.addEventListener('cart:open', function () {
    if (!isOpen()) openDrawer();
  });

  // Close when account drawer opens
  document.addEventListener('account:open', function () {
    if (isOpen()) closeDrawer();
  });

  document.addEventListener('click', function (e) {
    if (!isOpen()) return;
    if (e.target.closest('[data-cart-drawer]')) return;
    if (e.target.closest('[data-cart-trigger]')) return;
    closeDrawer();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      closeDrawer();
      trigger.focus();
    }
  });

})();