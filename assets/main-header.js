/**
 * Main Header Controller
 * File: assets/main-header.js
 * Loaded by: sections/main-header.liquid  (defer)
 *
 * Responsibilities:
 *   1. Sticky scroll shadow  (.is-scrolled on scroll)
 *   2. Hamburger → mobile nav drawer (open / close / Escape / outside-click)
 *   3. Focus trap inside the open mobile nav
 *   4. Body scroll lock while nav is open
 *   5. Cart button  → dispatches  'cart:open'   custom event
 *   6. Cart badge   → listens for 'cart:updated' { detail: { count } }
 *
 * Search (predictive search, voice, category pill, recent searches) is
 * entirely handled by assets/header-search.js — this file does NOT touch
 * any .hs__* elements.
 *
 * Cart drawer integration example:
 *   // Open the drawer from any other script:
 *   document.dispatchEvent(new CustomEvent('cart:open'));
 *
 *   // Update the badge count after an add-to-cart:
 *   document.dispatchEvent(new CustomEvent('cart:updated', {
 *     detail: { count: 3 }
 *   }));
 */

(function () {
  'use strict';

  /* ── Element refs ─────────────────────────────────────────────────────── */
  var header    = document.getElementById('main-header');
  var navToggle = document.getElementById('main-header-nav-toggle');
  var mobileNav = document.getElementById('main-header-mobile-nav');
  var cartBtn   = document.getElementById('main-header-cart-toggle');

  /* ── Focusable selector for focus trap ───────────────────────────────── */
  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /* ─────────────────────────────────────────────────────────────────────
     1. STICKY SCROLL SHADOW
     ───────────────────────────────────────────────────────────────────── */
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 4);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); /* set initial state */
  }

  /* ─────────────────────────────────────────────────────────────────────
     2 – 4. MOBILE NAV DRAWER
     ───────────────────────────────────────────────────────────────────── */
  if (!navToggle || !mobileNav) {
    /* Mobile nav elements are optional — skip gracefully */
    setupCart();
    return;
  }

  var navOpen = false;

  function focusableEls() {
    return Array.prototype.slice.call(mobileNav.querySelectorAll(FOCUSABLE));
  }

  function openNav() {
    navOpen = true;
    mobileNav.hidden = false;
    mobileNav.removeAttribute('aria-hidden');
    mobileNav.classList.add('is-open');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.classList.add('is-open');
    document.body.classList.add('nav-is-open');
    var first = focusableEls()[0];
    if (first) first.focus();
  }

  function closeNav() {
    navOpen = false;
    mobileNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.classList.remove('is-open');
    document.body.classList.remove('nav-is-open');
    navToggle.focus();

    mobileNav.addEventListener('transitionend', function onEnd() {
      mobileNav.removeEventListener('transitionend', onEnd);
      if (!navOpen) {
        mobileNav.hidden = true;
        mobileNav.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function trapFocus(e) {
    if (!navOpen) return;
    var els   = focusableEls();
    if (!els.length) return;
    var first = els[0];
    var last  = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }

  navToggle.addEventListener('click', function () {
    navOpen ? closeNav() : openNav();
  });

  document.addEventListener('click', function (e) {
    if (navOpen && !mobileNav.contains(e.target) && e.target !== navToggle) {
      closeNav();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && navOpen) { closeNav(); return; }
    if (e.key === 'Tab'    && navOpen) { trapFocus(e); }
  });

  /* ─────────────────────────────────────────────────────────────────────
     5 – 6. CART
     ───────────────────────────────────────────────────────────────────── */
  setupCart();

  function setupCart() {
    /* 5. Cart button — open drawer */
    if (cartBtn) {
      cartBtn.addEventListener('click', function () {
        document.dispatchEvent(new CustomEvent('cart:open', { bubbles: true }));
        cartBtn.setAttribute('aria-expanded', 'true');
      });
    }

    /* 6. Cart badge — sync on cart:updated */
    document.addEventListener('cart:updated', function (e) {
      var count = (e.detail && typeof e.detail.count === 'number') ? e.detail.count : 0;

      var badge = document.querySelector('[data-cart-count]');
      if (badge) {
        badge.textContent = count;
        badge.classList.toggle('main-header__cart-badge--hidden', count === 0);
      }

      if (cartBtn) {
        var noun = count === 1 ? 'item' : 'items';
        cartBtn.setAttribute('aria-label', 'Open cart, ' + count + ' ' + noun);
      }
    });
  }

})();