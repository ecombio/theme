/**
 * Utility Bar
 * File: assets/utility-bar.js
 * Loaded by: sections/utility-bar.liquid
 *
 * Responsibilities:
 *  1. Teleport the region dropdown to <body> (escapes header stacking contexts)
 *  2. Position the dropdown anchored below the trigger button (position: fixed)
 *  3. Open / close / Escape-key / click-outside behaviour
 *  4. Focus trap inside the dropdown (required by role="dialog" + aria-modal)
 *  5. Country search filtering with empty-state message
 *  6. Graceful flag image fallback on 404
 *  7. Auto-submit currency & locale selects (no inline onchange handlers)
 */

(function () {
  'use strict';

  /* ── Element IDs ── */
  var IDS = {
    trigger:      'utility-bar-region-trigger',
    dropdown:     'utility-bar-region-dropdown',
    close:        'utility-bar-region-close',
    search:       'utility-bar-region-search',
    list:         'utility-bar-region-list',
    empty:        'utility-bar-region-empty',
    currencyForm: 'utility-bar-currency-form',
    localeForm:   'utility-bar-locale-form',
  };

  /* ── Focusable elements for focus trap ── */
  var FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /* ── Grab elements ── */
  var trigger  = document.getElementById(IDS.trigger);
  var dropdown = document.getElementById(IDS.dropdown);
  var closeBtn = document.getElementById(IDS.close);
  var search   = document.getElementById(IDS.search);
  var list     = document.getElementById(IDS.list);
  var empty    = document.getElementById(IDS.empty);

  /* Bail if the section isn't on this page */
  if (!trigger || !dropdown) return;

  /* ─────────────────────────────────────────────
     1. TELEPORT DROPDOWN TO <body>
        Escapes overflow:hidden / stacking contexts in the header.
     ───────────────────────────────────────────── */
  document.body.appendChild(dropdown);

  /* ─────────────────────────────────────────────
     2. POSITIONING  (position:fixed → viewport coords)
     ───────────────────────────────────────────── */
  function positionDropdown() {
    var rect  = trigger.getBoundingClientRect();
    var dropW = 320;
    var vw    = window.innerWidth;
    var left  = rect.right - dropW;

    if (left < 8)               left = 8;
    if (left + dropW > vw - 8)  left = vw - dropW - 8;

    dropdown.style.top  = (rect.bottom + 6) + 'px';
    dropdown.style.left = left + 'px';
  }

  /* ─────────────────────────────────────────────
     3. OPEN / CLOSE
     ───────────────────────────────────────────── */
  function openPicker() {
    positionDropdown();
    dropdown.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-open');
    /* Move focus into the dropdown */
    if (search) {
      search.focus();
    } else {
      var first = getFocusableEls()[0];
      if (first) first.focus();
    }
  }

  function closePicker() {
    dropdown.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('is-open');
    /* Reset search */
    if (search) {
      search.value = '';
      filterList('');
    }
  }

  /* ─────────────────────────────────────────────
     4. FOCUS TRAP
        Keeps Tab / Shift+Tab cycling inside while the
        dialog is open (required by role="dialog" aria-modal).
     ───────────────────────────────────────────── */
  function getFocusableEls() {
    return Array.prototype.slice.call(
      dropdown.querySelectorAll(FOCUSABLE_SELECTORS)
    );
  }

  function trapFocus(e) {
    if (dropdown.hidden) return;
    var focusable = getFocusableEls();
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

  /* ─────────────────────────────────────────────
     5. COUNTRY SEARCH FILTER
     ───────────────────────────────────────────── */
  function filterList(query) {
    if (!list) return;
    var items   = list.querySelectorAll('.region-dropdown__item');
    var q       = query.toLowerCase().trim();
    var visible = 0;

    items.forEach(function (item) {
      var name  = item.getAttribute('data-country') || '';
      var match = q.length === 0 || name.indexOf(q) !== -1;
      item.hidden = !match;
      if (match) visible++;
    });

    if (empty) {
      if (visible === 0 && q.length > 0) {
        empty.classList.add('region-dropdown__empty--visible');
      } else {
        empty.classList.remove('region-dropdown__empty--visible');
      }
    }
  }

  /* ─────────────────────────────────────────────
     6. FLAG IMAGE FALLBACK
        Hides any broken flag <img> gracefully.
     ───────────────────────────────────────────── */
  function attachFlagFallbacks(root) {
    var flags = root.querySelectorAll('.region-dropdown__flag, .utility-bar__flag');
    flags.forEach(function (img) {
      img.addEventListener('error', function () {
        this.style.display = 'none';
      });
    });
  }
  attachFlagFallbacks(document);

  /* ─────────────────────────────────────────────
     7. AUTO-SUBMIT CURRENCY & LOCALE SELECTS
        Replaces inline onchange="this.form.submit()".
     ───────────────────────────────────────────── */
  function attachSelectAutoSubmit(formId) {
    var form = document.getElementById(formId);
    if (!form) return;
    var select = form.querySelector('select');
    if (select) {
      select.addEventListener('change', function () {
        form.submit();
      });
    }
  }
  attachSelectAutoSubmit(IDS.currencyForm);
  attachSelectAutoSubmit(IDS.localeForm);

  /* ─────────────────────────────────────────────
     EVENT WIRING
     ───────────────────────────────────────────── */

  /* Toggle on trigger click */
  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    dropdown.hidden ? openPicker() : closePicker();
  });

  /* Close button */
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      closePicker();
      trigger.focus();
    });
  }

  /* Click outside */
  document.addEventListener('click', function (e) {
    if (!dropdown.hidden && !dropdown.contains(e.target) && e.target !== trigger) {
      closePicker();
    }
  });

  /* Keyboard: Escape closes; Tab is trapped inside */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !dropdown.hidden) {
      closePicker();
      trigger.focus();
      return;
    }
    if (e.key === 'Tab' && !dropdown.hidden) {
      trapFocus(e);
    }
  });

  /* Reposition on scroll / resize while open */
  window.addEventListener('scroll', function () {
    if (!dropdown.hidden) positionDropdown();
  }, { passive: true });

  window.addEventListener('resize', function () {
    if (!dropdown.hidden) positionDropdown();
  }, { passive: true });

  /* Search input */
  if (search) {
    search.addEventListener('input', function () {
      filterList(this.value);
    });
  }

  /* Close after country is selected */
  if (list) {
    list.addEventListener('click', function (e) {
      if (e.target.closest('.region-dropdown__country-btn')) closePicker();
    });
  }

})();
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