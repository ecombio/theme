/* ============================================================
   main-wishlist.js
   Reads `shopify_wishlist` from localStorage, fetches each
   product via /products/{handle}.js, and renders cards.

   Storage format (written by card-product-features.js):
     [{ id: "123456", handle: "my-product" }, …]

   Backward-compat: bare string entries (old format) are
   skipped — the user just needs to re-toggle those items.
   ============================================================ */

(function () {
  'use strict';

  var WISHLIST_KEY = 'shopify_wishlist';
  var settings     = window.__wishlistPageSettings || {};

  /* ── Helpers ─────────────────────────────────────────────── */
  function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; } catch (e) { return []; }
  }
  function saveWishlist(list) {
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
  }
  function entryId(entry) {
    return typeof entry === 'object' ? entry.id : entry;
  }

  function formatMoney(cents) {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  /* ── DOM refs ────────────────────────────────────────────── */
  var grid    = document.querySelector('[data-wishlist-grid]');
  var empty   = document.querySelector('[data-wishlist-empty]');
  var actions = document.querySelector('[data-wishlist-actions]');
  var counter = document.querySelector('[data-wishlist-count]');
  var tpl     = document.getElementById('wishlist-card-tpl');

  if (!grid || !tpl) return;

  /* ── Fetch one product by handle via Shopify Product API ─── */
  function fetchProduct(handle) {
    return fetch('/products/' + handle + '.js')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* ── Build a card node from the <template> ───────────────── */
  function buildCard(product) {
    var frag    = tpl.content.cloneNode(true);
    var card    = frag.querySelector('.card-product--wishlist-page');
    var id      = String(product.id);
    var variant = product.variants && product.variants[0];
    var image   = product.featured_image || (product.images && product.images[0]) || '';
    var url     = '/products/' + product.handle;

    card.setAttribute('data-product-id', id);
    card.setAttribute('data-product-handle', product.handle);

    /* image */
    var img  = card.querySelector('.card-product__img');
    var aImg = card.querySelector('.card-product__media-link');
    img.src = image + (image.indexOf('?') === -1 ? '?' : '&') + 'width=600';
    img.alt = product.title;
    aImg.href = url;
    aImg.setAttribute('aria-label', product.title);

    /* wishlist (remove) btn */
    var wBtn = card.querySelector('[data-wishlist-btn]');
    wBtn.setAttribute('data-product-id', id);

    /* title */
    var titleA = card.querySelector('[data-title]');
    titleA.textContent = product.title;
    titleA.href = url;

    /* vendor */
    var vendorEl = card.querySelector('[data-vendor]');
    if (vendorEl) vendorEl.textContent = product.vendor || '';

    /* price */
    var priceEl = card.querySelector('[data-price]');
    if (priceEl && variant) {
      var compare = variant.compare_at_price;
      if (compare && compare > variant.price) {
        priceEl.innerHTML =
          '<s class="card-product__price--compare">' + formatMoney(compare) + '</s> ' +
          '<span class="card-product__price--sale">' + formatMoney(variant.price) + '</span>';
      } else {
        priceEl.textContent = formatMoney(variant.price);
      }
    }

    /* ATC */
    var atcBtn = card.querySelector('[data-atc-btn]');
    if (atcBtn) {
      if (variant) {
        atcBtn.setAttribute('data-variant-id', variant.id);
        if (!variant.available) {
          atcBtn.textContent = 'Sold out';
          atcBtn.disabled    = true;
        }
      } else {
        atcBtn.disabled = true;
      }
    }

    return card;
  }

  /* ── Update header count ─────────────────────────────────── */
  function updateCount(n) {
    if (!counter) return;
    counter.textContent = n === 0 ? '' : n === 1 ? '1 item saved' : n + ' items saved';
  }

  /* ── Show / hide empty state ─────────────────────────────── */
  function setEmpty(isEmpty) {
    grid.hidden    = isEmpty;
    empty.hidden   = !isEmpty;
    actions.hidden = isEmpty;
  }

  /* ── Remove a card from the grid ────────────────────────── */
  function removeCard(productId) {
    var card = grid.querySelector('[data-product-id="' + productId + '"]');
    if (card) {
      card.classList.add('card-product--removing');
      card.addEventListener('transitionend', function () { card.remove(); }, { once: true });
      setTimeout(function () { if (card.parentNode) card.remove(); }, 400);
    }

    var list = getWishlist().filter(function (entry) { return entryId(entry) !== productId; });
    saveWishlist(list);
    updateCount(list.length);
    if (list.length === 0) setEmpty(true);
  }

  /* ── Add to cart ─────────────────────────────────────────── */
  function addToCart(variantId, btn) {
    btn.disabled    = true;
    btn.textContent = 'Adding…';

    fetch(settings.routes && settings.routes.cartAdd || '/cart/add.js', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ id: variantId, quantity: 1 })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.status) {
          btn.textContent = 'Error';
          setTimeout(function () { btn.textContent = 'Add to cart'; btn.disabled = false; }, 1500);
        } else {
          btn.textContent = 'Added!';
          document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));
document.dispatchEvent(new CustomEvent('cart:open',    { bubbles: true }));
          setTimeout(function () { btn.textContent = 'Add to cart'; btn.disabled = false; }, 1500);
        }
      })
      .catch(function () {
        btn.textContent = 'Error';
        setTimeout(function () { btn.textContent = 'Add to cart'; btn.disabled = false; }, 1500);
      });
  }

  /* ── Render all saved products ───────────────────────────── */
  function render() {
    var entries = getWishlist();

    /* Filter to only object entries with a handle (new format) */
    var valid = entries.filter(function (e) {
      return typeof e === 'object' && e.handle;
    });

    updateCount(valid.length);

    if (valid.length === 0) {
      setEmpty(true);
      return;
    }

    grid.hidden    = false;
    actions.hidden = false;
    empty.hidden   = true;

    var fetches = valid.map(function (entry) {
      return fetchProduct(entry.handle);
    });

    Promise.all(fetches).then(function (products) {
      grid.innerHTML = '';
      var rendered = 0;

      products.forEach(function (product) {
        if (!product) return;
        grid.appendChild(buildCard(product));
        rendered++;
      });

      updateCount(rendered);
      if (rendered === 0) setEmpty(true);
    });
  }

  /* ── Event delegation ────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    /* Remove button on wishlist page cards */
    var wBtn = e.target.closest('[data-wishlist-btn]');
    if (wBtn && grid.contains(wBtn)) {
      removeCard(wBtn.getAttribute('data-product-id'));
      return;
    }

    /* ATC buttons */
    var atcBtn = e.target.closest('[data-atc-btn]');
    if (atcBtn && grid.contains(atcBtn)) {
      var variantId = atcBtn.getAttribute('data-variant-id');
      if (variantId) addToCart(variantId, atcBtn);
      return;
    }

    /* Clear all */
    if (e.target.closest('[data-wishlist-clear]')) {
      saveWishlist([]);
      grid.innerHTML = '';
      updateCount(0);
      setEmpty(true);
      document.dispatchEvent(new CustomEvent('wishlist:cleared', { bubbles: true }));
    }
  });

  /* Sync when toggled from another section on the same page */
  document.addEventListener('wishlist:toggle', function (e) {
    var detail = e.detail || {};
    if (!detail.wishlisted) {
      removeCard(String(detail.productId));
    }
  });

  /* Sync if wishlist changes in another tab */
  window.addEventListener('storage', function (e) {
    if (e.key === WISHLIST_KEY) render();
  });

  /* ── Boot ────────────────────────────────────────────────── */
  render();

})();