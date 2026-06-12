/* ============================================================
   card-product-features.js
   Add to Cart · Wishlist · Compare · Quick View
   ============================================================
   Drop this file in /assets/ and include it with:
     {{ 'card-product-features.js' | asset_url | script_tag }}
   after main-collection.js
   ============================================================ */

(function () {
  'use strict';

  function qs(sel, root)  { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return [...(root || document).querySelectorAll(sel)]; }

  /* ──────────────────────────────────────────────────────────
     ADD TO CART
     Uses the Shopify AJAX Cart API (/cart/add.js)
  ────────────────────────────────────────────────────────── */
  function initAddToCart() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-atc-btn]');
      if (!btn || btn.disabled) return;

      var variantId = btn.getAttribute('data-variant-id');
      if (!variantId) return;

      var label = btn.querySelector('.card-product__atc-label');
      var originalHTML = btn.innerHTML;

      btn.classList.add('is-loading');
      if (label) label.textContent = 'Adding…';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ id: variantId, quantity: 1 })
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Cart error');
          return res.json();
        })
        .then(function () {
          if (label) label.textContent = 'Added!';
          btn.classList.remove('is-loading');

          // Dispatch event so any cart drawer / bubble can update
          document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));

          // Reset button after 1.8 s
          setTimeout(function () { btn.innerHTML = originalHTML; }, 1800);
        })
        .catch(function () {
          btn.classList.remove('is-loading');
          if (label) label.textContent = 'Try again';
          setTimeout(function () { btn.innerHTML = originalHTML; }, 2000);
        });
    });
  }

  /* ──────────────────────────────────────────────────────────
     WISHLIST
     Lightweight localStorage wishlist — replace with your
     preferred wishlist app hook (e.g. Swym, Wishlist Plus)
     by listening for the 'wishlist:toggle' CustomEvent.
  ────────────────────────────────────────────────────────── */
  var WISHLIST_KEY = 'shopify_wishlist';

  function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveWishlist(list) {
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(list)); } catch (e) { /* */ }
  }

  function syncWishlistButtons() {
    var list = getWishlist();
    qsa('[data-wishlist-btn]').forEach(function (btn) {
      var id = btn.getAttribute('data-product-id');
      var pressed = list.indexOf(id) !== -1;
      btn.setAttribute('aria-pressed', String(pressed));
    });
  }

  function initWishlist() {
    syncWishlistButtons();

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-wishlist-btn]');
      if (!btn) return;

      var id   = btn.getAttribute('data-product-id');
      var list = getWishlist();
      var idx  = list.indexOf(id);

      if (idx === -1) {
        list.push(id);
      } else {
        list.splice(idx, 1);
      }

      saveWishlist(list);
      syncWishlistButtons();

      // Dispatch for third-party integrations
      document.dispatchEvent(new CustomEvent('wishlist:toggle', {
        bubbles: true,
        detail: { productId: id, wishlisted: idx === -1 }
      }));
    });
  }

  /* ──────────────────────────────────────────────────────────
     COMPARE
     Stores up to 5 products; updates .compare-bar if present.

     Bar snippet selectors used:
       .compare-bar            — the wrapper element
       .compare-bar__counter   — the "N" in "Compare (N/5)"
       .compare-bar__list      — <ul> where item thumbnails render
       [data-compare-submit]   — the "Compare" open button
       [data-compare-clear]    — both "Clear all" buttons
       [data-compare-remove]   — remove buttons injected per item
     Product card selectors:
       [data-compare-checkbox] — the checkbox input on each card
         data-product-id       — product ID string
         data-product-title    — display name
         data-product-image    — thumbnail URL
         data-product-price    — formatted price string
  ────────────────────────────────────────────────────────── */
  var COMPARE_MAX  = 5;   // matches the 5 placeholders in the bar snippet
  var compareItems = [];  // [{ id, title, image, price }, …]

  function findCompareItem(id) {
    return compareItems.findIndex(function (x) { return x.id === id; });
  }

  function syncCompareCheckboxes() {
    qsa('[data-compare-checkbox]').forEach(function (cb) {
      var id = cb.getAttribute('data-product-id');
      cb.checked = findCompareItem(id) !== -1;
    });
  }

  function renderCompareBar() {
    var bar = qs('.compare-bar');
    if (!bar) return;

    // ── counter "N/5" ──────────────────────────────────────
    var counterEl = qs('.compare-bar__counter', bar);
    if (counterEl) counterEl.textContent = compareItems.length;

    // ── thumbnail list ─────────────────────────────────────
    var list = qs('.compare-bar__list', bar);
    if (list) {
      list.innerHTML = '';

      // filled slots
      compareItems.forEach(function (item) {
        var li = document.createElement('li');
        li.className = 'compare-bar__item';
        li.innerHTML =
          '<img src="' + item.image + '" alt="' + item.title + '" width="48" height="48" style="border-radius:6px;object-fit:cover;">' +
          '<button class="compare-bar__item-remove" type="button" aria-label="Remove ' + item.title + ' from compare" data-compare-remove="' + item.id + '">&times;</button>';
        list.appendChild(li);
      });

      // empty placeholder slots
      for (var i = compareItems.length; i < COMPARE_MAX; i++) {
        var li = document.createElement('li');
        li.className = 'compare-bar__item compare-bar__item-placeholder';
        li.setAttribute('aria-hidden', 'true');
        list.appendChild(li);
      }
    }

    // ── open/submit button ─────────────────────────────────
    // Enabled only when ≥ 2 products are selected
    var submitBtn = qs('[data-compare-submit]', bar);
    if (submitBtn) submitBtn.disabled = compareItems.length < 2;

    // ── bar visibility ─────────────────────────────────────
    bar.classList.toggle('is-active', compareItems.length > 0);
  }

  function buildCompareUrl() {
    var ids = compareItems.map(function (x) { return x.id; });
    return '/pages/compare?ids=' + ids.join(',');
  }

  function initCompare() {
    // Checkbox toggled on a product card
    document.addEventListener('change', function (e) {
      var cb = e.target.closest('[data-compare-checkbox]');
      if (!cb) return;

      var id  = cb.getAttribute('data-product-id');
      var idx = findCompareItem(id);

      if (cb.checked) {
        if (compareItems.length >= COMPARE_MAX) {
          // Already at limit — revert the checkbox and flash the bar
          cb.checked = false;
          var bar = qs('.compare-bar');
          if (bar) {
            bar.classList.add('is-limit');
            setTimeout(function () { bar.classList.remove('is-limit'); }, 600);
          }
          return;
        }
        compareItems.push({
          id   : id,
          title: cb.getAttribute('data-product-title') || '',
          image: cb.getAttribute('data-product-image') || '',
          price: cb.getAttribute('data-product-price') || ''
        });
      } else {
        if (idx !== -1) compareItems.splice(idx, 1);
      }

      syncCompareCheckboxes();
      renderCompareBar();

      document.dispatchEvent(new CustomEvent('compare:updated', {
        bubbles: true,
        detail: { items: compareItems }
      }));
    });

    // ── Remove a single item via its × button in the bar ───
    document.addEventListener('click', function (e) {
      var removeBtn = e.target.closest('[data-compare-remove]');
      if (!removeBtn) return;
      var id  = removeBtn.getAttribute('data-compare-remove');
      var idx = findCompareItem(id);
      if (idx !== -1) compareItems.splice(idx, 1);
      syncCompareCheckboxes();
      renderCompareBar();
    });

    // ── Clear all (both desktop + mobile buttons) ──────────
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-compare-clear]')) return;
      compareItems = [];
      syncCompareCheckboxes();
      renderCompareBar();
    });

    // ── Open compare page / drawer ─────────────────────────
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-compare-submit]')) return;
      if (compareItems.length >= 2) window.location.href = buildCompareUrl();
    });

    // Initial render (sets placeholders, disables button)
    renderCompareBar();
  }

  /* ──────────────────────────────────────────────────────────
     QUICK VIEW
     Opens a modal overlay and fetches product HTML via
     the Shopify /?view=quickview URL pattern.
     Your theme needs a product.quickview template, OR adapt
     the fetch target below to your theme's pattern.
  ────────────────────────────────────────────────────────── */
  function buildModal() {
    if (qs('#card-quickview-modal')) return;

    var modal = document.createElement('div');
    modal.id  = 'card-quickview-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Quick view');
    modal.className = 'quickview-modal';
    modal.innerHTML =
      '<div class="quickview-modal__backdrop"></div>' +
      '<div class="quickview-modal__panel">' +
        '<button class="quickview-modal__close" type="button" aria-label="Close quick view">&times;</button>' +
        '<div class="quickview-modal__body"></div>' +
      '</div>';
    document.body.appendChild(modal);

    // Close handlers
    modal.querySelector('.quickview-modal__backdrop').addEventListener('click', closeModal);
    modal.querySelector('.quickview-modal__close').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  function openModal(html) {
    var modal = qs('#card-quickview-modal');
    if (!modal) return;
    modal.querySelector('.quickview-modal__body').innerHTML = html;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    modal.querySelector('.quickview-modal__close').focus();
  }

  function closeModal() {
    var modal = qs('#card-quickview-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function initQuickView() {
    buildModal();

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-quickview-btn]');
      if (!btn) return;

      var handle = btn.getAttribute('data-product-handle');
      if (!handle) return;

      var body = qs('#card-quickview-modal .quickview-modal__body');
      body.innerHTML = '<div class="quickview-modal__loading" aria-live="polite">Loading…</div>';
      openModal(body.innerHTML);

      // Fetch via ?view=quickview — create a product.quickview.liquid template
      // that returns just the product form HTML.
      fetch('/products/' + handle + '?view=quickview&sections=product-quickview', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
        .then(function (res) {
          if (!res.ok) {
            // Fallback: render a minimal linked card
            return null;
          }
          return res.text();
        })
        .then(function (html) {
          if (!html) {
            body.innerHTML =
              '<div style="padding:2rem;text-align:center">' +
              '<p style="margin:0 0 1rem;font-size:0.9rem;color:#555">Preview unavailable — view the full product page.</p>' +
              '<a href="/products/' + handle + '" class="card-product__atc-btn" style="display:inline-flex;text-decoration:none">View product</a>' +
              '</div>';
            return;
          }
          body.innerHTML = html;
        })
        .catch(function () {
          body.innerHTML = '<p style="padding:2rem;color:#c0392b">Unable to load product preview.</p>';
        });
    });
  }

  /* ──────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initAddToCart();
    initWishlist();
    initCompare();
    initQuickView();
  });

})();