/* ============================================================
   main-wishlist.js
   Reads `shopify_wishlist` from localStorage, fetches each
   product via /products/{handle}.js, renders real card-product
   markup (matching the live collection card exactly).
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
    return typeof entry === 'object' ? String(entry.id) : String(entry);
  }
  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function savings(price, compare) {
    return '$' + ((compare - price) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* srcset helper — mirrors Shopify CDN width params */
  function buildSrcset(src, widths) {
    if (!src) return '';
    return widths.map(function (w) {
      var sep = src.indexOf('?') === -1 ? '?' : '&';
      return src + sep + 'width=' + w + ' ' + w + 'w';
    }).join(', ');
  }
  function sized(src, w) {
    if (!src) return '';
    var sep = src.indexOf('?') === -1 ? '?' : '&';
    return src + sep + 'width=' + w;
  }

  /* ── DOM refs ────────────────────────────────────────────── */
  var grid    = document.querySelector('[data-wishlist-grid]');
  var empty   = document.querySelector('[data-wishlist-empty]');
  var actions = document.querySelector('[data-wishlist-actions]');
  var counter = document.querySelector('[data-wishlist-count]');
  var tpl     = document.getElementById('wishlist-card-tpl');

  if (!grid || !tpl) return;

  /* ── Fetch product JSON ──────────────────────────────────── */
  function fetchProduct(handle) {
    return fetch('/products/' + handle + '.js')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* ── Build card from <template> ─────────────────────────── */
  function buildCard(product) {
    var frag    = tpl.content.cloneNode(true);
    var card    = frag.querySelector('.card-product');
    var variant = product.variants && product.variants[0];
    var id      = String(product.id);
    var handle  = product.handle;
    var url     = '/products/' + handle;
    var title   = product.title;

    /* Images — primary + secondary (second image if available) */
    var images  = product.images || [];
    var img1src = images[0] || product.featured_image || '';
    var img2src = images[1] || '';
    var srcWidths = [300, 400, 600, 800];

    /* Card root */
    card.setAttribute('data-product-id', id);
    card.setAttribute('data-product-handle', handle);

    /* Image wrapper link */
    var imgWrap = card.querySelector('.card-product__image-wrapper');
    imgWrap.href = url;
    imgWrap.setAttribute('aria-label', title);

    /* Primary image */
    var imgPrimary = card.querySelector('.card-product__image--primary');
    imgPrimary.src    = sized(img1src, 800);
    imgPrimary.srcset = buildSrcset(img1src, srcWidths);
    imgPrimary.alt    = title;

    /* Secondary image */
    var imgSecondary = card.querySelector('[data-secondary-img]');
    if (img2src) {
      imgSecondary.src    = sized(img2src, 800);
      imgSecondary.srcset = buildSrcset(img2src, srcWidths);
      imgSecondary.alt    = title + ' — alternate view';
    } else {
      imgSecondary.remove();
    }

    /* Wishlist (remove) button */
    var wBtn = card.querySelector('[data-wishlist-btn]');
    wBtn.setAttribute('data-product-id', id);
    wBtn.setAttribute('aria-label', 'Remove ' + title + ' from wishlist');

    /* Quick view button */
    var qvBtn = card.querySelector('[data-quickview-btn]');
    qvBtn.setAttribute('data-product-handle', handle);
    qvBtn.setAttribute('data-product-url', url);
    qvBtn.setAttribute('aria-label', 'Quick view ' + title);

    /* Vendor */
    var vendorEl = card.querySelector('[data-vendor]');
    if (product.vendor) {
      vendorEl.textContent = product.vendor;
    } else {
      vendorEl.remove();
    }

    /* Title link */
    var titleEl = card.querySelector('[data-title]');
    titleEl.textContent = title;
    titleEl.href = url;

    /* Price + savings */
    var price   = variant ? variant.price : null;
    var compare = variant ? variant.compare_at_price : null;

    var priceEl   = card.querySelector('[data-price-current]');
    var savingsRow = card.querySelector('[data-savings-row]');
    var saveBadge  = card.querySelector('[data-save-badge]');
    var compareEl  = card.querySelector('[data-compare-price]');

    if (price !== null) {
      if (compare && compare > price) {
        priceEl.textContent = formatMoney(price);
        priceEl.classList.add('card-product__price--sale');
        saveBadge.textContent = 'Save ' + savings(price, compare);
        compareEl.textContent = formatMoney(compare);
        savingsRow.hidden = false;
      } else {
        priceEl.textContent = formatMoney(price);
        savingsRow.remove();
      }
    } else {
      priceEl.remove();
      savingsRow.remove();
    }

    /* ETA — hidden on wishlist page (no section setting available client-side) */
    var etaEl = card.querySelector('[data-eta]');
    if (etaEl) etaEl.remove();

    /* ATC button */
    var atcBtn = card.querySelector('[data-atc-btn]');
    atcBtn.setAttribute('data-product-title', title);
    atcBtn.setAttribute('aria-label', 'Add ' + title + ' to cart');
    if (variant) {
      atcBtn.setAttribute('data-variant-id', String(variant.id));
      if (!variant.available) {
        atcBtn.querySelector('.card-product__atc-label').textContent = 'Sold out';
        atcBtn.disabled = true;
      }
    } else {
      atcBtn.disabled = true;
    }

    /* Compare checkbox */
    var compareChk = card.querySelector('[data-compare-checkbox]');
    compareChk.setAttribute('data-product-id', id);
    compareChk.setAttribute('data-product-handle', handle);
    compareChk.setAttribute('data-product-title', title);
    compareChk.setAttribute('data-product-image', sized(img1src, 120));
    compareChk.setAttribute('data-product-price', price !== null ? formatMoney(price) : '');
    compareChk.setAttribute('aria-label', 'Compare ' + title);

    return card;
  }

  /* ── Count / empty state ─────────────────────────────────── */
  function updateCount(n) {
    if (!counter) return;
    counter.textContent = n === 0 ? '' : n === 1 ? '1 item saved' : n + ' items saved';
  }
  function setEmpty(isEmpty) {
    grid.hidden    = isEmpty;
    empty.hidden   = !isEmpty;
    actions.hidden = isEmpty;
  }

  /* ── Remove a card ───────────────────────────────────────── */
  function removeCard(productId) {
    var card = grid.querySelector('[data-product-id="' + productId + '"]');
    if (card) {
      card.classList.add('card-product--removing');
      card.addEventListener('transitionend', function () { card.remove(); }, { once: true });
      setTimeout(function () { if (card.parentNode) card.remove(); }, 400);
    }
    var list = getWishlist().filter(function (e) { return entryId(e) !== productId; });
    saveWishlist(list);
    updateCount(list.length);
    if (list.length === 0) setEmpty(true);
  }

  /* ── Add to cart ─────────────────────────────────────────── */
  function addToCart(variantId, btn) {
    var label = btn.querySelector('.card-product__atc-label');
    btn.classList.add('is-loading');
    btn.disabled = true;
    if (label) label.textContent = 'Adding…';

    fetch((settings.routes && settings.routes.cartAdd) || '/cart/add.js', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ id: variantId, quantity: 1 })
    })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function () {
        btn.classList.remove('is-loading');
        if (label) label.textContent = 'Added!';
        document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));
        setTimeout(function () { if (label) label.textContent = 'Add to cart'; btn.disabled = false; }, 1800);
      })
      .catch(function () {
        btn.classList.remove('is-loading');
        if (label) label.textContent = 'Try again';
        setTimeout(function () { if (label) label.textContent = 'Add to cart'; btn.disabled = false; }, 2000);
      });
  }

  /* ── Render ──────────────────────────────────────────────── */
  function render() {
    var entries = getWishlist().filter(function (e) {
      return typeof e === 'object' && e.handle;
    });

    updateCount(entries.length);
    if (entries.length === 0) { setEmpty(true); return; }

    grid.hidden    = false;
    actions.hidden = false;
    empty.hidden   = true;

    Promise.all(entries.map(function (e) { return fetchProduct(e.handle); }))
      .then(function (products) {
        grid.innerHTML = '';
        var rendered = 0;
        products.forEach(function (p) {
          if (!p) return;
          grid.appendChild(buildCard(p));
          rendered++;
        });
        updateCount(rendered);
        if (rendered === 0) setEmpty(true);
      });
  }

  /* ── Events ──────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    /* Wishlist remove */
    var wBtn = e.target.closest('[data-wishlist-btn]');
    if (wBtn && grid.contains(wBtn)) {
      removeCard(wBtn.getAttribute('data-product-id'));
      return;
    }
    /* ATC */
    var atcBtn = e.target.closest('[data-atc-btn]');
    if (atcBtn && grid.contains(atcBtn)) {
      var vid = atcBtn.getAttribute('data-variant-id');
      if (vid) addToCart(vid, atcBtn);
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

  /* Sync removals triggered elsewhere on same page */
  document.addEventListener('wishlist:toggle', function (e) {
    var d = e.detail || {};
    if (!d.wishlisted) removeCard(String(d.productId));
  });

  /* Sync across tabs */
  window.addEventListener('storage', function (e) {
    if (e.key === WISHLIST_KEY) render();
  });

  render();

})();