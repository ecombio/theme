/**
 * product-card.js
 * Handles all interactivity for snippets/product-card.liquid
 *
 * Features:
 *   • Add to Cart  — POST /cart/add.js, fires cart:updated + cart:open
 *   • Wishlist     — localStorage, aria-pressed sync
 *   • Compare      — in-memory, renders compare-bar, max 5
 *   • Quick View   — fetches ?sections=product-quickview, modal UI
 */

(() => {
  'use strict';

  // ── Tiny helpers ────────────────────────────────────────────────────────────
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const emit = (name, detail = {}) =>
    document.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));

  // ══════════════════════════════════════════════════════════════════════════════
  // ADD TO CART
  // Attributes: [data-atc-btn] [data-variant-id] [data-atc-label]
  // ══════════════════════════════════════════════════════════════════════════════
  function initAddToCart() {
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-atc-btn]');
      if (!btn || btn.disabled) return;

      const variantId = btn.getAttribute('data-variant-id');
      if (!variantId) return;

      const label       = btn.querySelector('[data-atc-label]');
      const originalHTML = btn.innerHTML;

      btn.classList.add('is-loading');
      btn.disabled = true;
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
  // WISHLIST
  // Storage key: 'shopify_wishlist'
  // Format: [{ id: "123", handle: "my-product" }, …]
  // Attributes: [data-wishlist-btn] [data-product-id]
  //             btn.closest('[data-product-handle]') → handle
  // ══════════════════════════════════════════════════════════════════════════════
  const WISHLIST_KEY = 'shopify_wishlist';

  function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; }
    catch { return []; }
  }

  function saveWishlist(list) {
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(list)); }
    catch { /* storage full */ }
  }

  function entryId(entry) {
    return typeof entry === 'object' ? entry.id : entry;
  }

  function syncWishlistButtons() {
    const ids = getWishlist().map(entryId);
    qsa('[data-wishlist-btn]').forEach((btn) => {
      const pressed = ids.includes(btn.getAttribute('data-product-id'));
      btn.setAttribute('aria-pressed', String(pressed));
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

    // Re-sync when recently-viewed injects new cards into the DOM
    document.addEventListener('productcard:injected', () => {
      syncWishlistButtons();
      syncCompareCheckboxes();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // COMPARE
  // Max 5 items. Renders into .compare-bar (snippets/compare-bar.liquid)
  // Attributes on checkbox: [data-compare-checkbox] [data-product-id]
  //   [data-product-handle] [data-product-title]
  //   [data-product-image]  [data-product-price]
  // Bar: .compare-bar  .compare-bar__counter  .compare-bar__list
  //      [data-compare-submit]  [data-compare-clear]
  //      [data-compare-remove] (injected per item)
  // Compare URL: /pages/compare?handles=a,b,c
  // ══════════════════════════════════════════════════════════════════════════════
  const COMPARE_MAX = 5;
  let compareItems  = []; // [{ id, handle, title, image, price }]

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

      // Empty placeholder slots up to max
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
      syncCompareCheckboxes();
      renderCompareBar();
    });

    // Clear all
    document.body.addEventListener('click', (e) => {
      if (!e.target.closest('[data-compare-clear]')) return;
      compareItems = [];
      syncCompareCheckboxes();
      renderCompareBar();
    });

    // Submit → navigate to compare page
    document.body.addEventListener('click', (e) => {
      if (!e.target.closest('[data-compare-submit]')) return;
      if (compareItems.length >= 2) {
        window.location.href =
          '/pages/compare?handles=' + compareItems.map((x) => x.handle).join(',');
      }
    });

    renderCompareBar();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // QUICK VIEW
  // Attributes: [data-quickview-btn] [data-product-handle]
  // Fetches: /products/{handle}?sections=product-quickview
  // Renders into: #product-card-quickview-modal
  // ══════════════════════════════════════════════════════════════════════════════
  const QV_MODAL_ID = 'product-card-quickview-modal';

  function buildQuickViewModal() {
    if (qs(`#${QV_MODAL_ID}`)) return;

    const modal = document.createElement('div');
    modal.id        = QV_MODAL_ID;
    modal.className = 'quickview-modal';
    modal.setAttribute('role',       'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Quick view');
    modal.setAttribute('hidden',     '');
    modal.innerHTML = `
      <div class="quickview-modal__backdrop" data-qv-close></div>
      <div class="quickview-modal__panel">
        <button class="quickview-modal__close" type="button" aria-label="Close quick view" data-qv-close>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div class="quickview-modal__body"></div>
      </div>`;
    document.body.appendChild(modal);
  }

  function openQuickView(html) {
    const modal = qs(`#${QV_MODAL_ID}`);
    if (!modal) return;
    qs('.quickview-modal__body', modal).innerHTML = html;
    modal.removeAttribute('hidden');
    modal.classList.add('is-open');
    document.documentElement.classList.add('quickview-open');
    requestAnimationFrame(() => qs('[data-qv-close]', modal)?.focus());
  }

  function closeQuickView() {
    const modal = qs(`#${QV_MODAL_ID}`);
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('hidden', '');
    document.documentElement.classList.remove('quickview-open');
  }

  function initQuickView() {
    buildQuickViewModal();

    // Open on button click
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-quickview-btn]');
      if (!btn) return;

      const handle = btn.getAttribute('data-product-handle');
      if (!handle) return;

      openQuickView('<div class="quickview-modal__loading" role="status">Loading…</div>');

      fetch(`/products/${handle}?sections=product-quickview`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.['product-quickview']) {
            openQuickView(`
              <div class="quickview-modal__error">
                <p>Preview unavailable.</p>
                <a href="/products/${handle}" class="quickview-modal__fallback-link">View product</a>
              </div>`);
            return;
          }
          openQuickView(data['product-quickview']);
        })
        .catch(() => {
          openQuickView('<p class="quickview-modal__error">Unable to load preview.</p>');
        });
    });

    // Close on backdrop / close button
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('[data-qv-close]')) closeQuickView();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeQuickView();
    });

    // Focus trap
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const modal = qs(`#${QV_MODAL_ID}`);
      if (!modal?.classList.contains('is-open')) return;

      const focusable = qsa(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        modal
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // QUICK VIEW — in-modal UI
  // ══════════════════════════════════════════════════════════════════════════════
  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');
  }

  function updateQVVariant(wrap, variant) {
    const select = qs('[data-qv-variant-select]', wrap);
    if (select) select.value = variant.id;

    const atcBtn = qs('.qv__atc', wrap);
    if (atcBtn) {
      atcBtn.setAttribute('data-variant-id', variant.id);
      const label = atcBtn.querySelector('[data-atc-label]');
      if (variant.available) {
        atcBtn.disabled = false;
        atcBtn.classList.remove('qv__atc--soldout');
        if (label) label.textContent = 'Add to cart';
      } else {
        atcBtn.disabled = true;
        atcBtn.classList.add('qv__atc--soldout');
        if (label) label.textContent = 'Sold out';
      }
    }

    const priceEl = qs('.qv__price', wrap);
    if (priceEl) {
      let html = '';
      if (variant.compare_at_price && variant.compare_at_price > variant.price) {
        html += `<s class="qv__price-compare">${formatMoney(variant.compare_at_price)}</s>`;
        html += `<span class="qv__price-sale-badge">Save ${formatMoney(variant.compare_at_price - variant.price)}</span>`;
      }
      html += `<span class="qv__price-current">${formatMoney(variant.price)}</span>`;
      priceEl.innerHTML = html;
    }
  }

  function initQuickViewUI() {
    document.body.addEventListener('click', (e) => {

      const thumb = e.target.closest('[data-qv-thumb]');
      if (thumb) {
        const wrap    = thumb.closest('.qv');
        const mainImg = qs('#qv-main-img', wrap);
        if (mainImg) {
          mainImg.src = thumb.getAttribute('data-src');
          mainImg.alt = thumb.getAttribute('data-alt') || '';
        }
        qsa('[data-qv-thumb]', wrap).forEach((t) => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
        return;
      }

      const optBtn = e.target.closest('[data-qv-swatch], [data-qv-option-btn]');
      if (!optBtn) return;

      const wrap  = optBtn.closest('.qv');
      if (!wrap) return;
      const productId = wrap.getAttribute('data-product-id');

      const group = optBtn.closest('[role="radiogroup"]');
      if (group) {
        qsa('[data-qv-swatch], [data-qv-option-btn]', group).forEach((b) => {
          b.classList.remove('is-active');
          b.setAttribute('aria-checked', 'false');
        });
        optBtn.classList.add('is-active');
        optBtn.setAttribute('aria-checked', 'true');
      }

      const optionRow     = optBtn.closest('.qv__option');
      const selectedLabel = optionRow && qs('[data-qv-option-selected]', optionRow);
      if (selectedLabel) selectedLabel.textContent = optBtn.getAttribute('data-value');

      const jsonEl = document.getElementById(`qv-variant-data-${productId}`);
      if (!jsonEl) return;

      let variants;
      try { variants = JSON.parse(jsonEl.textContent); }
      catch { return; }

      const currentOptions = [];
      qsa('[data-qv-swatch].is-active, [data-qv-option-btn].is-active', wrap).forEach((b) => {
        const idx = parseInt(b.getAttribute('data-option-index'), 10);
        currentOptions[idx] = b.getAttribute('data-value');
      });

      const variant = variants.find((v) =>
        v.options.every((opt, i) => opt === currentOptions[i])
      );

      if (variant) updateQVVariant(wrap, variant);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════════════════════════
  function init() {
    initAddToCart();
    initWishlist();
    initCompare();
    initQuickView();
    initQuickViewUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
