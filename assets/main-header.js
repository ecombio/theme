/**
 * Main Header
 * File: assets/main-header.js
 * Loaded by: sections/main-header.liquid
 *
 * Responsibilities:
 *  1. Sticky scroll — adds .is-scrolled shadow to header
 *  2. Mobile nav — hamburger toggle, close on outside click / Escape
 *  3. Mobile nav — focus trap while drawer is open
 *  4. Mobile nav — body scroll lock
 *  5. Cart button — dispatches 'cart:open' custom event for the cart drawer
 *  6. Cart count — listens for 'cart:updated' custom event and syncs the
 *     badge count + aria-label without a page reload
 *
 * Cart drawer integration
 * ───────────────────────
 * Opening the drawer:
 *   document.addEventListener('cart:open', function () { … });
 *
 * Updating the count after an add-to-cart:
 *   document.dispatchEvent(new CustomEvent('cart:updated', {
 *     detail: { count: 3 }   // pass the new item count
 *   }));
 */

(function () {
  'use strict';

  /* ── Element IDs ── */
  var IDS = {
    header:     'main-header',
    navToggle:  'main-header-nav-toggle',
    mobileNav:  'main-header-mobile-nav',
    cartToggle: 'main-header-cart-toggle',
  };

  /* ── Focusable selector for focus trap ── */
  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /* ── Grab elements ── */
  var header    = document.getElementById(IDS.header);
  var navToggle = document.getElementById(IDS.navToggle);
  var mobileNav = document.getElementById(IDS.mobileNav);
  var cartBtn   = document.getElementById(IDS.cartToggle);

  /* ─────────────────────────────────────────────
     1. STICKY SCROLL SHADOW
     ───────────────────────────────────────────── */
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 4);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ─────────────────────────────────────────────
     2 + 3 + 4. MOBILE NAV
     ───────────────────────────────────────────── */
  if (!navToggle || !mobileNav) return;

  var navIsOpen = false;

  function getFocusableEls() {
    return Array.prototype.slice.call(mobileNav.querySelectorAll(FOCUSABLE));
  }

  function openNav() {
    navIsOpen = true;
    mobileNav.hidden = false;
    mobileNav.removeAttribute('aria-hidden');
    mobileNav.classList.add('is-open');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.classList.add('is-open');
    document.body.classList.add('nav-is-open');

    var first = getFocusableEls()[0];
    if (first) first.focus();
  }

  function closeNav() {
    navIsOpen = false;
    mobileNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.classList.remove('is-open');
    document.body.classList.remove('nav-is-open');
    navToggle.focus();

    mobileNav.addEventListener('transitionend', function onEnd() {
      mobileNav.removeEventListener('transitionend', onEnd);
      if (!navIsOpen) {
        mobileNav.hidden = true;
        mobileNav.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function trapFocus(e) {
    if (!navIsOpen) return;
    var focusable = getFocusableEls();
    if (!focusable.length) return;

    var first = focusable[0];
    var last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }

  navToggle.addEventListener('click', function () {
    navIsOpen ? closeNav() : openNav();
  });

  document.addEventListener('click', function (e) {
    if (navIsOpen && !mobileNav.contains(e.target) && e.target !== navToggle) {
      closeNav();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && navIsOpen) { closeNav(); return; }
    if (e.key === 'Tab'    && navIsOpen) { trapFocus(e); }
  });

  /* ─────────────────────────────────────────────
     5. CART BUTTON — open drawer
     ───────────────────────────────────────────── */
  if (cartBtn) {
    cartBtn.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('cart:open', { bubbles: true }));
      cartBtn.setAttribute('aria-expanded', 'true');
    });
  }

  /* ─────────────────────────────────────────────
     6. CART COUNT — sync badge on cart:updated
     Fired by the cart drawer / add-to-cart JS:
       document.dispatchEvent(new CustomEvent('cart:updated', {
         detail: { count: <number> }
       }));
     ───────────────────────────────────────────── */
  document.addEventListener('cart:updated', function (e) {
    var count = (e.detail && typeof e.detail.count === 'number')
      ? e.detail.count
      : 0;

    /* Update badge text */
    var badge = document.querySelector('[data-cart-count]');
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('main-header__cart-badge--hidden', count === 0);
    }

    /* Keep aria-label in sync so screen readers announce the new count */
    if (cartBtn) {
      var noun = count === 1 ? 'item' : 'items';
      cartBtn.setAttribute('aria-label', 'Open cart, ' + count + ' ' + noun);
    }
  });

})();