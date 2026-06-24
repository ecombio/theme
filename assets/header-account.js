/**
 * header-account.js
 *
 * Manages the account trigger → account drawer interaction.
 *
 * CONTRACT (data attributes):
 *   [data-account-trigger]   <a> in snippets/header-account.liquid
 *   [data-account-drawer]    drawer shell, wherever it lives in the DOM
 *
 * PROGRESSIVE ENHANCEMENT:
 *   If no [data-account-drawer] is found, the <a> keeps its href="/account"
 *   and works as a plain link. Nothing in this file breaks that fallback.
 *
 * PATTERN:
 *   Follows the same IIFE + 'use strict' convention as header.js.
 *   Mirrors the nav-dropdown open/close/escape/outside-click shape so
 *   behaviour is consistent across all header interactive regions.
 *
 * LOADED VIA theme.liquid with `defer`. Do NOT load inside the snippet.
 */

(function () {
  'use strict';

  const trigger = document.querySelector('[data-account-trigger]');
  const drawer  = document.querySelector('[data-account-drawer]');

  // No drawer in DOM yet — leave the <a> as a plain link and exit.
  if (!trigger || !drawer) return;


  // ── HELPERS ────────────────────────────────────────────────────────────────

  function isOpen() {
    return drawer.hidden === false;
  }

  function openDrawer() {
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');

    // Move focus to the first interactive element inside the drawer.
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


  // ── INITIAL STATE ──────────────────────────────────────────────────────────
  //
  // Ensure the drawer starts closed and aria-expanded is set on the trigger
  // (the Liquid only sets aria-label; aria-expanded only makes sense once
  // JS has confirmed a drawer exists).

  closeDrawer();


  // ── TRIGGER CLICK ──────────────────────────────────────────────────────────

  trigger.addEventListener('click', function (e) {
    e.preventDefault();            // stop href="/account" navigation
    toggleDrawer();
  });


  // ── OUTSIDE CLICK ──────────────────────────────────────────────────────────
  //
  // Matches the nav dropdown outside-click pattern in header.js.

  document.addEventListener('click', function (e) {
    if (!isOpen()) return;
    if (e.target.closest('[data-account-drawer]')) return;
    if (e.target.closest('[data-account-trigger]')) return;
    closeDrawer();
  });


  // ── ESCAPE KEY ─────────────────────────────────────────────────────────────
  //
  // Closes the drawer and returns focus to the trigger — mirrors the nav
  // Escape handler in header.js so keyboard behaviour is consistent.

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      closeDrawer();
      trigger.focus();             // return focus to where the user came from
    }
  });


  // ── CART:OPEN EVENT ────────────────────────────────────────────────────────
  //
  // If the cart drawer fires a custom event (e.g. cart:open), close the
  // account drawer so only one panel is open at a time.
  //
  // Remove this block if your theme never opens the cart while the account
  // drawer could be open.

  document.addEventListener('cart:open', function () {
    if (isOpen()) closeDrawer();
  });

})();