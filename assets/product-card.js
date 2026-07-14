/**
 * product-card.js
 * Handles all interactivity for snippets/product-card.liquid
 *
 * Features:
 *   • Add to Cart  — POST /cart/add.js, fires cart:updated + cart:open
 *   • Wishlist     — localStorage, aria-pressed + aria-label sync
 *   • Compare      — localStorage, renders compare-bar, max 5
 *   • Quick View   — delegates to product-quickview.js via custom event
 *   • Sticky offsets — measures the real header/toolbar height and exposes
 *     them as CSS custom properties so sticky elements stack correctly
 *
 * Fixes applied (from Architecture_Review, June 2026):
 *   [1]  ATC: btn.disabled = true on start prevents double-submit
 *   [2]  ATC: label selector uses [data-atc-label], not a CSS class
 *   [3]  ATC: is-added class added for CSS green state
 *   [4]  Wishlist: aria-label updated on sync ("Add to" / "Remove from")
 *   [5]  Compare: `let` throughout — no var re-declaration bugs
 *   [6]  Compare: compareItems.length = 0 instead of full reassignment
 *   [7]  Money: single shared formatMoney() reads window.Shopify currency
 *   [8]  QV: removed — Quick View is now owned by product-quickview.js.
 *            This file fires 'quickview:open' and product-quickview.js listens.
 *   [9]  Init: readyState guard handles deferred/async script loading
 *   [10] productcard:injected: re-syncs wishlist + compare on dynamic injection
 *   [11] Sticky offsets (2026-07): base.css's .sticky-header only sets
 *        `position: sticky; top: 0;` — it never defines
 *        --sticky-header-height. main-collection.css's .collection-toolbar
 *        and .collection-filter both read var(--sticky-header-height, 0) /
 *        var(--sticky-toolbar-height, 64px) to stack below the header
 *        instead of under it. Since that property was never actually set
 *        anywhere, both fell back to their defaults, which don't match the
 *        header's real height — so on scroll, the toolbar (and the top of
 *        whatever content follows it) slid up underneath the header instead
 *        of stopping below it. Header height isn't a fixed constant (it
 *        changes with announcement bars, font-size settings, breakpoints),
 *        so it's measured at runtime here rather than hardcoded in CSS.
 *        This file is already loaded globally via theme.liquid (see header
 *        comment above), so the measurement lives here instead of in a
 *        separate script.
 *   [12] Compare persistence (2026-07): compareItems used to live in
 *        memory only, so a page refresh (or navigating away and back)
 *        silently lost every selection — nothing backed it. It now
 *        reads/writes the same 'shopify_compare' localStorage key that
 *        main-compare.js and header-compare.js already read, using the
 *        same {id, handle} shape those files expect PLUS the extra
 *        title/image/price fields this file's own compare-bar needs for
 *        its thumbnails — the extra fields are simply ignored by the
 *        other two files, which only look at .id and .handle.
 */

(() => {
  'use strict';

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const emit = (name, detail = {}) =>
    document.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));

  // ── [7] Shared money formatter ───────────────────────────────────────────────
  // Reads store currency symbol from Shopify global; falls back to '$'.
  // Used by ATC, Compare bar, and exposed on window.EcombioCard for QV.
  function formatMoney(cents) {
    const symbol = window.Shopify?.currency?.symbol ?? '$';
    const amount = (cents / 100).toFixed(2).replace(/\.00$/, '');
    return symbol + amount;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // [1][2][3] ADD TO CART
  // Attributes: [data-atc-btn]  [data-variant-id]  [data-atc-label]
  // ══════════════════════════════════════════════════════════════════════════════
  function initAddToCart() {
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-atc-btn]');
      if (!btn || btn.disabled) return;

      const variantId = btn.getAttribute('data-variant-id');
      if (!variantId) return;

      // [2] data-attribute hook — zero CSS class dependency
      const label        = btn.querySelector('[data-atc-label]');
      const originalHTML = btn.innerHTML;

      // [1] Disable immediately to block double-submit
      btn.disabled = true;
      btn.classList.add('is-loading');
      if (label) label.textContent = 'Adding…';

      fetch('/cart/add.js', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: variantId, quantity: 1 }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Cart error');
          return res.json();
        })
        .then(() => {
          // [3] is-added drives the green CSS state
          btn.classList.remove('is-loading');
          btn.classList.add('is-added');
          if (label) label.textContent = 'Added!';

          emit('cart:updated');
          emit('cart:open');

          setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('is-added');
            btn.disabled = false;
          }, 1800);
        })
        .catch(() => {
          btn.classList.remove('is-loading');
          btn.disabled = false;
          if (label) label.textContent = 'Try again';
          setTimeout(() => {
            btn.innerHTML = originalHTML;
          }, 2000);
        });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // [4] WISHLIST
  // Storage key : 'shopify_wishlist'
  // Format      : [{ id: "123", handle: "my-product" }, …]
  // Backward-compat: bare string IDs from old format are normalised by entryId()
  // Attributes  : [data-wishlist-btn]  [data-product-id]
  //               btn.closest('[data-product-handle]') → handle
  // ══════════════════════════════════════════════════════════════════════════════
  const WISHLIST_KEY = 'shopify_wishlist';

  function getWishlist() {
    try   { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; }
    catch { return []; }
  }

  function saveWishlist(list) {
    try   { localStorage.setItem(WISHLIST_KEY, JSON.stringify(list)); }
    catch { /* storage full or private browsing */ }
  }

  // Normalise legacy bare-string IDs
  function entryId(entry) {
    return typeof entry === 'object' ? entry.id : entry;
  }

  function syncWishlistButtons() {
    const ids = getWishlist().map(entryId);
    qsa('[data-wishlist-btn]').forEach((btn) => {
      const pressed = ids.includes(btn.getAttribute('data-product-id'));
      btn.setAttribute('aria-pressed', String(pressed));
      // [4] aria-label reflects current state so screen readers announce correctly
      btn.setAttribute(
        'aria-label',
        `${pressed ? 'Remove from' : 'Add to'} wishlist`
      );
    });
  }

  function initWishlist() {
    syncWishlistButtons();

    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-wishlist-btn]');
      if (!btn) return;

      const id     = btn.getAttribute('data-product-id');
      const card   = btn.closest('[data-product-handle]');
      const handle = card?.getAttribute('data-product-handle') || '';

      const list = getWishlist();
      const ids  = list.map(entryId);
      const idx  = ids.indexOf(id);

      if (idx === -1) {
        list.push({ id, handle });
      } else {
        list.splice(idx, 1);
      }

      saveWishlist(list);
      syncWishlistButtons();
      emit('wishlist:toggle', { productId: id, wishlisted: idx === -1 });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // [5][6][12] COMPARE
  // Max 5 items. Renders into .compare-bar (snippets/compare-bar.liquid)
  //
  // Storage key : 'shopify_compare' — same key main-compare.js and
  //               header-compare.js read. Persisted shape is
  //               { id, handle, title, image, price } — main-compare.js
  //               and header-compare.js only ever read .id / .handle off
  //               each entry, so the extra display fields this file
  //               stores alongside them are inert as far as those two
  //               files are concerned.
  //
  // Checkbox attributes:
  //   [data-compare-checkbox]  [data-product-id]   [data-product-handle]
  //   [data-product-title]     [data-product-image] [data-product-price]
  //
  // Bar elements:
  //   .compare-bar              .compare-bar__counter    .compare-bar__list
  //   [data-compare-submit]     [data-compare-clear]
  //   [data-compare-remove]     (injected per item)
  //
  // Compare page: /pages/compare — the page reads 'shopify_compare'
  // from localStorage directly, so no URL query string is needed to
  // hand off the selection anymore.
  // ══════════════════════════════════════════════════════════════════════════════
  const COMPARE_KEY = 'shopify_compare';
  const COMPARE_MAX = 5;
  // [5] let — avoids var re-declaration bugs and keeps mutability explicit
  let compareItems = []; // [{ id, handle, title, image, price }]

  function getCompareStorage() {
    try   { return JSON.parse(localStorage.getItem(COMPARE_KEY)) || []; }
    catch { return []; }
  }

  function saveCompareStorage(list) {
    try   { localStorage.setItem(COMPARE_KEY, JSON.stringify(list)); }
    catch { /* storage full or private browsing */ }
  }

  // Defensive filter for anything malformed / legacy bare strings —
  // compare has always required the richer object shape, unlike wishlist.
  function validCompareEntries(list) {
    return list.filter((entry) => entry && typeof entry === 'object' && entry.id && entry.handle);
  }

  function findCompare(id) {
    return compareItems.findIndex((x) => x.id === id);
  }

  function syncCompareCheckboxes() {
    qsa('[data-compare-checkbox]').forEach((cb) => {
      cb.checked = findCompare(cb.getAttribute('data-product-id')) !== -1;
    });
  }

  function renderCompareBar() {
    const bar = qs('.compare-bar');
    if (!bar) return;

    const counter = qs('.compare-bar__counter', bar);
    if (counter) counter.textContent = compareItems.length;

    const list = qs('.compare-bar__list', bar);
    if (list) {
      list.innerHTML = '';

      // Filled slots
      compareItems.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'compare-bar__item';
        li.innerHTML = `
          <img src="${item.image}" alt="${item.title}" width="48" height="48">
          <button
            class="compare-bar__item-remove"
            type="button"
            aria-label="Remove ${item.title} from compare"
            data-compare-remove="${item.id}"
          >&times;</button>`;
        list.appendChild(li);
      });

      // [5] `let` in for-loop — no var re-declaration
      for (let i = compareItems.length; i < COMPARE_MAX; i++) {
        const li = document.createElement('li');
        li.className = 'compare-bar__item compare-bar__item-placeholder';
        li.setAttribute('aria-hidden', 'true');
        list.appendChild(li);
      }
    }

    const submit = qs('[data-compare-submit]', bar);
    if (submit) submit.disabled = compareItems.length < 2;

    bar.classList.toggle('is-active', compareItems.length > 0);
  }

  function initCompare() {
    // [12] Hydrate from storage on load — this is what was missing.
    // Without it, compareItems always started as [], so a refresh (or
    // simply landing on a fresh page) looked identical to "nothing
    // selected" even though localStorage still had the real list.
    compareItems = validCompareEntries(getCompareStorage());
    syncCompareCheckboxes();
    renderCompareBar();

    // Checkbox toggle
    document.body.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-compare-checkbox]');
      if (!cb) return;

      const id  = cb.getAttribute('data-product-id');
      const idx = findCompare(id);

      if (cb.checked) {
        if (compareItems.length >= COMPARE_MAX) {
          cb.checked = false;
          const bar = qs('.compare-bar');
          if (bar) {
            bar.classList.add('is-limit');
            setTimeout(() => bar.classList.remove('is-limit'), 600);
          }
          return;
        }
        compareItems.push({
          id,
          handle: cb.getAttribute('data-product-handle') || '',
          title:  cb.getAttribute('data-product-title')  || '',
          image:  cb.getAttribute('data-product-image')  || '',
          price:  cb.getAttribute('data-product-price')  || '',
        });
      } else {
        if (idx !== -1) compareItems.splice(idx, 1);
      }

      saveCompareStorage(compareItems); // [12]
      syncCompareCheckboxes();
      renderCompareBar();
      emit('compare:updated', { items: compareItems });
    });

    // Per-item remove (injected into bar)
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-compare-remove]');
      if (!btn) return;
      const idx = findCompare(btn.getAttribute('data-compare-remove'));
      if (idx !== -1) compareItems.splice(idx, 1);
      saveCompareStorage(compareItems); // [12]
      syncCompareCheckboxes();
      renderCompareBar();
      emit('compare:updated', { items: compareItems });
    });

    // [6] Clear all — mutation rather than reassignment keeps reference stable
    document.body.addEventListener('click', (e) => {
      if (!e.target.closest('[data-compare-clear]')) return;
      compareItems.length = 0;
      saveCompareStorage(compareItems); // [12]
      syncCompareCheckboxes();
      renderCompareBar();
      emit('compare:updated', { items: compareItems });
    });

    // Submit → navigate to compare page. No query string needed —
    // localStorage already holds the selection.
    document.body.addEventListener('click', (e) => {
      if (!e.target.closest('[data-compare-submit]')) return;
      if (compareItems.length >= 2) {
        window.location.href = '/pages/compare';
      }
    });

    // [12] Stay in sync if another tab changes the list, or if the
    // compare page itself (main-compare.js) removes/clears items and
    // the visitor navigates back here without a full reload in
    // between (e.g. back/forward cache).
    window.addEventListener('storage', (e) => {
      if (e.key !== COMPARE_KEY) return;
      compareItems = validCompareEntries(getCompareStorage());
      syncCompareCheckboxes();
      renderCompareBar();
    });

    document.addEventListener('compare:toggle', (e) => {
      const detail = e.detail || {};
      if (!detail.fromPage) return; // only re-hydrate for changes made on the compare page itself
      compareItems = validCompareEntries(getCompareStorage());
      syncCompareCheckboxes();
      renderCompareBar();
    });

    document.addEventListener('compare:cleared', () => {
      compareItems.length = 0;
      syncCompareCheckboxes();
      renderCompareBar();
    });

    renderCompareBar();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // [8] QUICK VIEW — trigger only
  // This file fires 'quickview:open' with the product handle.
  // All modal rendering, fetch, variant UI, and focus management
  // lives in product-quickview.js — loaded independently.
  // ══════════════════════════════════════════════════════════════════════════════
  function initQuickViewTrigger() {
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-quickview-btn]');
      if (!btn) return;
      const handle = btn.getAttribute('data-product-handle');
      if (!handle) return;
      emit('quickview:open', { handle, trigger: btn });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // [11] STICKY OFFSETS
  // Measures .sticky-header (global) and #collection-toolbar (collection
  // pages only) and writes their real pixel heights to CSS custom
  // properties on :root, so main-collection.css's sticky toolbar/filter
  // math is based on real values instead of unset defaults.
  // ══════════════════════════════════════════════════════════════════════════════
  const root = document.documentElement;

  function px(value) {
    return Math.round(value) + 'px';
  }

  function setStickyOffsets() {
    const header = qs('.sticky-header');
    if (header) {
      root.style.setProperty('--sticky-header-height', px(header.offsetHeight));
    }

    // Only present on collection pages — guard so this runs safely
    // on every page even though it's loaded globally.
    const toolbar = document.getElementById('collection-toolbar');
    if (toolbar) {
      root.style.setProperty('--sticky-toolbar-height', px(toolbar.offsetHeight));
    }
  }

  function initStickyOffsets() {
    setStickyOffsets();

    // Re-measure on resize (breakpoint changes, orientation change,
    // announcement bar collapsing, etc.). Debounced to avoid thrashing
    // layout on every resize tick.
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(setStickyOffsets, 100);
    });

    // Re-measure if header content changes size after load (e.g. an
    // announcement bar dismissed via JS, or a font/webfont swap
    // reflowing text) without a full resize event firing.
    const header = qs('.sticky-header');
    if (header && 'ResizeObserver' in window) {
      const ro = new ResizeObserver(() => setStickyOffsets());
      ro.observe(header);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // [10] productcard:injected
  // Fire this event after dynamically inserting new cards into the DOM
  // (e.g. recently-viewed, infinite scroll) to re-sync state indicators.
  // ══════════════════════════════════════════════════════════════════════════════
  document.addEventListener('productcard:injected', () => {
    syncWishlistButtons();
    syncCompareCheckboxes();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // Exposed on window so product-quickview.js (and any future script)
  // can call formatMoney without duplicating the implementation.
  // ══════════════════════════════════════════════════════════════════════════════
  window.EcombioCard = {
    formatMoney,
    syncWishlistButtons,
    syncCompareCheckboxes,
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // [9] INIT — readyState guard handles deferred / async script loading
  // ══════════════════════════════════════════════════════════════════════════════
  function init() {
    initAddToCart();
    initWishlist();
    initCompare();
    initQuickViewTrigger();
    initStickyOffsets();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();