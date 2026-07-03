/**
 * header.js
 * File: assets/header.js
 * Loaded by: sections/header.liquid
 *
 * Consolidates three previously separate script tags into one file:
 *   - assets/main-header.js
 *   - assets/header-cart.js
 *   - assets/header-account.js
 *
 * Each module below is still wrapped in its own IIFE, so they remain
 * self-contained (no shared globals, no naming collisions) and run in
 * the same order they did as separate <script defer> tags.
 *
 * NOTE: assets/utility-bar.js now lives on its own again (loaded by
 * sections/utility-bar.liquid, not header.liquid) and is NOT part of
 * this bundle.
 *
 * NOTE: link-list.js, mega-menu.js, and flyout-menu.js are intentionally
 * NOT included here — they remain separate <script> tags in header.liquid.
 */

/* ============================================================
   MODULE: Main Header Controller
   Original file: assets/main-header.js
   Loaded by: sections/main-header.liquid (defer)
   ============================================================
 * Responsibilities:
 *   1. Hamburger → mobile nav drawer (open / close / Escape / outside-click)
 *   2. Focus trap inside the open mobile nav
 *   3. Body scroll lock while nav is open
 *
 * Sticky scroll shadow (.is-scrolled) is NOT handled here. It used to be
 * (a separate `window.scrollY > 4` listener toggling the same class this
 * module previously owned), but assets/main-header-sticky.js also toggles
 * .is-scrolled on the same #main-header element at a different threshold
 * (60px), so the two were fighting over the same class on every scroll
 * event. main-header-sticky.js is the more complete implementation (it
 * also owns .is-sticky, the CSS var height sync, and the sticky hamburger)
 * so this module's copy was removed — same fix pattern already applied
 * to the cart-badge duplication noted below.
 *
 * Cart button/badge behaviour is NOT handled here either — that logic
 * lives entirely in the Header Cart module below (originally
 * header-cart.js), which is the more complete implementation ("(N)"
 * badge formatting + pop animation + drawer-open/close aria sync). This
 * module used to duplicate a lighter version of that logic; it has been
 * removed to avoid two listeners fighting over the same
 * #main-header-cart-toggle button and 'cart:updated' event.
 *
 * Search (predictive search, voice, category pill, recent searches) is
 * entirely handled by assets/header-search.js — this file does NOT touch
 * any .hs__* elements.
 */

(function () {
  'use strict';

  /* ── Element refs ─────────────────────────────────────────────────────── */
  var navToggle = document.getElementById('main-header-nav-toggle');
  var mobileNav = document.getElementById('main-header-mobile-nav');

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
     MOBILE NAV DRAWER
     ───────────────────────────────────────────────────────────────────── */
  if (!navToggle || !mobileNav) {
    /* Mobile nav elements are optional — skip gracefully */
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

})();


/* ============================================================
   MODULE: Header Cart
   Original file: assets/header-cart.js
   Loaded by: sections/main-header.liquid
   ============================================================
 * Responsibilities:
 *   1. Click → dispatch 'cart:open' (cart-drawer.js opens the drawer)
 *   2. 'cart:updated' → update badge count + aria-label
 *   3. 'cart:drawer:open' / 'cart:drawer:close' → sync aria-expanded
 *
 * Dependencies:
 *   snippets/header-cart.liquid  — provides the cart trigger button
 *                                  ([data-ecombio-cart-trigger]) and
 *                                  the count badge ([data-ecombio-cart-count])
 *   assets/cart-drawer.js        — listens for 'cart:open',
 *                                  dispatches 'cart:drawer:open'
 *
 * FIXED (previously broken):
 *   - This module used to look up the trigger via
 *     document.getElementById('main-header-cart-toggle'). That ID does not
 *     exist anywhere in header-cart.liquid — the real button only carries
 *     data-ecombio-cart-trigger. init() was bailing out on line 2 every
 *     single time, so NONE of this module's listeners were ever attached.
 *   - COUNT_SEL was '[data-cart-count]'; the real badge markup uses
 *     '[data-ecombio-cart-count]'. Even if init() hadn't bailed, the
 *     badge would never have been found.
 *   - Badge format was hardcoded to "(N)"; the real badge renders a plain
 *     number ("9", not "(9)"). Changed to match cart-drawer.js's format
 *     so the two don't fight over how the same element should look.
 *
 * No global variables. Wraps everything in an IIFE to stay side-effect-free.
 */

(function () {
  'use strict';

  /* ── Selectors ──────────────────────────────────────────────────────────── */

  const TRIGGER_SEL = '[data-ecombio-cart-trigger]'; // SOURCE OF TRUTH — must match header-cart.liquid
  const COUNT_SEL   = '[data-ecombio-cart-count]';   // SOURCE OF TRUTH — must match header-cart.liquid + cart-drawer.js
  const HIDDEN_CLS  = 'main-header__cart-badge--hidden';
  const POP_CLS     = 'main-header__cart-badge--pop';

  /* ── Element refs (resolved after DOMContentLoaded) ─────────────────────── */

  let cartBtn = null;

  /* ── Helpers ────────────────────────────────────────────────────────────── */

  /**
   * Update every [data-ecombio-cart-count] badge in the document.
   * Renders as a plain number, matching the real markup and
   * cart-drawer.js's updateCountBadges — no parens, so the two
   * implementations agree on format instead of flip-flopping it.
   *
   * @param {number} count
   */
  function updateBadges(count) {
    document.querySelectorAll(COUNT_SEL).forEach(function (el) {
      el.textContent = String(count);
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
    cartBtn = document.querySelector(TRIGGER_SEL);
    if (!cartBtn) return; /* not on a page that includes the cart icon */

    /* 1. Click → open drawer via event (cart-drawer.js owns the open logic
          AND the actual toggle behavior via its own delegated listener on
          this same TRIGGER_SEL — this listener only needs to exist for
          pages/contexts where cart-drawer.js's body-level delegation
          hasn't been set up, so it's kept for redundancy/back-compat.
          It does not double-fire cart-drawer's own toggle since that one
          is a direct call, not an event listener on 'cart:open'.) */
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

  /* Run after DOM is ready. Previously loaded via a `defer` script tag, so
     DOMContentLoaded may have already fired in most browsers — guard either way. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());


/* ============================================================
   MODULE: Header Account
   Original file: assets/header-account.js
   Loaded by: sections/main-header.liquid
   ============================================================
 * The account icon is a plain anchor — no drawer, no AJAX.
 * This module's job is light: keep the aria-label in sync if the
 * customer session changes client-side (e.g. after a headless login),
 * and expose a small hook for themes that want to intercept the click
 * (e.g. to open an account flyout instead of navigating).
 *
 * If neither of those is needed for your theme, this module is optional —
 * header-account.liquid works standalone without it.
 *
 * Events dispatched:
 *   'account:link:click'  — bubbles from the anchor; detail: { loggedIn, href }
 *                           Intercept with e.preventDefault() to suppress navigation.
 *
 * No global variables. Wraps everything in an IIFE.
 */

(function () {
  'use strict';

  /* ── Selectors ──────────────────────────────────────────────────────────── */

  const ACCOUNT_SEL = '[data-account-link]';

  /* ── Init ───────────────────────────────────────────────────────────────── */

  function init() {
    var link = document.querySelector(ACCOUNT_SEL);
    if (!link) return; /* snippet not on this page */

    /* Dispatch a cancellable custom event on click so themes can intercept
       and open a flyout/modal without navigating. */
    link.addEventListener('click', function (e) {
      var loggedIn = link.href.indexOf('/account/login') === -1 &&
                     link.href.indexOf('/account/register') === -1;

      var dispatched = link.dispatchEvent(
        new CustomEvent('account:link:click', {
          bubbles:    true,
          cancelable: true,
          detail: {
            loggedIn: loggedIn,
            href:     link.href,
          },
        })
      );

      /* If a listener called e.preventDefault() on the custom event,
         suppress the anchor navigation too. */
      if (!dispatched) {
        e.preventDefault();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());