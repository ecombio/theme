/* ============================================================
   assets/product-card.js
   Loaded globally via theme.liquid — single file, no deps.

   Owns everything:
     • Add to Cart
     • Wishlist  (localStorage)
     • Compare   (up to 5, compare-bar sync)
     • Quick View (modal shell + panel interactivity)
       – thumbnail switcher
       – swatch / option-button variant selection
       – price + ATC sync on variant change
   ============================================================ */

(function () {
  'use strict';

  if (window.__productCardLoaded) return;
  window.__productCardLoaded = true;

  /* ── Helpers ─────────────────────────────────────────────── */
  function qs(sel, root)  { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function formatMoney(cents) {
    if (!cents && cents !== 0) return '';
    return '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');
  }

  /* ──────────────────────────────────────────────────────────
     ADD TO CART
  ────────────────────────────────────────────────────────── */
  function initAddToCart() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-atc-btn]');
      if (!btn || btn.disabled) return;

      var variantId = btn.getAttribute('data-variant-id');
      if (!variantId) return;

      var label        = qs('[data-atc-label]', btn) || qs('.card-product__atc-label', btn);
      var originalHTML = btn.innerHTML;

      btn.classList.add('is-loading');
      if (label) label.textContent = 'Adding…';

      fetch('/cart/add.js', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body:    JSON.stringify({ id: variantId, quantity: 1 })
      })
        .then(function (res) { if (!res.ok) throw new Error('Cart error'); return res.json(); })
        .then(function () {
          if (label) label.textContent = 'Added!';
          btn.classList.remove('is-loading');
          btn.classList.add('is-added');
          document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));
          document.dispatchEvent(new CustomEvent('cart:open',    { bubbles: true }));
          setTimeout(function () {
            btn.innerHTML = originalHTML;
            btn.classList.remove('is-added');
          }, 1800);
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
     Storage: [{ id: "123", handle: "my-product" }, …]
  ────────────────────────────────────────────────────────── */
  var WISHLIST_KEY = 'shopify_wishlist';

  function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; } catch (e) { return []; }
  }
  function saveWishlist(list) {
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(list)); } catch (e) { /* quota */ }
  }
  function entryId(entry) {
    return typeof entry === 'object' ? entry.id : entry;
  }

  function syncWishlistButtons() {
    var ids = getWishlist().map(entryId);
    qsa('[data-wishlist-btn]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(ids.indexOf(btn.getAttribute('data-product-id')) !== -1));
    });
  }

  function initWishlist() {
    syncWishlistButtons();
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-wishlist-btn]');
      if (!btn) return;

      var id     = btn.getAttribute('data-product-id');
      var card   = btn.closest('[data-product-handle]');
      var handle = (card && card.getAttribute('data-product-handle')) || '';

      var list = getWishlist();
      var ids  = list.map(entryId);
      var idx  = ids.indexOf(id);

      if (idx === -1) {
        list.push({ id: id, handle: handle });
      } else {
        list.splice(idx, 1);
      }

      saveWishlist(list);
      syncWishlistButtons();
      document.dispatchEvent(new CustomEvent('wishlist:toggle', {
        bubbles: true,
        detail:  { productId: id, wishlisted: idx === -1 }
      }));
    });
  }

  /* ──────────────────────────────────────────────────────────
     COMPARE
     URL: /pages/compare?handles=handle-a,handle-b,…
     Max: 5 items

     Card data attributes read:
       data-compare-checkbox
       data-product-id / data-product-handle
       data-product-title / data-product-image / data-product-price

     Bar elements:
       .compare-bar
       .compare-bar__counter
       .compare-bar__list
       [data-compare-submit]
       [data-compare-clear]
       [data-compare-remove]   (injected per item)
  ────────────────────────────────────────────────────────── */
  var COMPARE_MAX  = 5;
  var compareItems = [];

  function findCompareItem(id) {
    return compareItems.findIndex(function (x) { return x.id === id; });
  }

  function syncCompareCheckboxes() {
    qsa('[data-compare-checkbox]').forEach(function (cb) {
      cb.checked = findCompareItem(cb.getAttribute('data-product-id')) !== -1;
    });
  }

  function buildCompareUrl() {
    return '/pages/compare?handles=' + compareItems.map(function (x) { return x.handle; }).join(',');
  }

  function renderCompareBar() {
    var bar = qs('.compare-bar');
    if (!bar) return;

    var counterEl = qs('.compare-bar__counter', bar);
    if (counterEl) counterEl.textContent = compareItems.length;

    var list = qs('.compare-bar__list', bar);
    if (list) {
      list.innerHTML = '';
      compareItems.forEach(function (item) {
        var li = document.createElement('li');
        li.className = 'compare-bar__item';
        li.innerHTML =
          '<img src="' + item.image + '" alt="' + item.title + '" width="48" height="48" style="border-radius:6px;object-fit:cover;">' +
          '<button class="compare-bar__item-remove" type="button" aria-label="Remove ' + item.title + ' from compare" data-compare-remove="' + item.id + '">&times;</button>';
        list.appendChild(li);
      });
      for (var i = compareItems.length; i < COMPARE_MAX; i++) {
        var li = document.createElement('li');
        li.className = 'compare-bar__item compare-bar__item-placeholder';
        li.setAttribute('aria-hidden', 'true');
        list.appendChild(li);
      }
    }

    var submitBtn = qs('[data-compare-submit]', bar);
    if (submitBtn) submitBtn.disabled = compareItems.length < 2;

    bar.classList.toggle('is-active', compareItems.length > 0);
  }

  function initCompare() {
    document.addEventListener('change', function (e) {
      var cb = e.target.closest('[data-compare-checkbox]');
      if (!cb) return;

      var id  = cb.getAttribute('data-product-id');
      var idx = findCompareItem(id);

      if (cb.checked) {
        if (compareItems.length >= COMPARE_MAX) {
          cb.checked = false;
          var bar = qs('.compare-bar');
          if (bar) {
            bar.classList.add('is-limit');
            setTimeout(function () { bar.classList.remove('is-limit'); }, 600);
          }
          return;
        }
        compareItems.push({
          id    : id,
          handle: cb.getAttribute('data-product-handle') || '',
          title : cb.getAttribute('data-product-title')  || '',
          image : cb.getAttribute('data-product-image')  || '',
          price : cb.getAttribute('data-product-price')  || ''
        });
      } else {
        if (idx !== -1) compareItems.splice(idx, 1);
      }

      syncCompareCheckboxes();
      renderCompareBar();
      document.dispatchEvent(new CustomEvent('compare:updated', {
        bubbles: true,
        detail:  { items: compareItems }
      }));
    });

    document.addEventListener('click', function (e) {
      var removeBtn = e.target.closest('[data-compare-remove]');
      if (!removeBtn) return;
      var idx = findCompareItem(removeBtn.getAttribute('data-compare-remove'));
      if (idx !== -1) compareItems.splice(idx, 1);
      syncCompareCheckboxes();
      renderCompareBar();
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-compare-clear]')) return;
      compareItems = [];
      syncCompareCheckboxes();
      renderCompareBar();
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-compare-submit]')) return;
      if (compareItems.length >= 2) window.location.href = buildCompareUrl();
    });

    renderCompareBar();
  }

  /* ──────────────────────────────────────────────────────────
     QUICK VIEW — modal shell
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
    qs('.quickview-modal__backdrop', modal).addEventListener('click', closeModal);
    qs('.quickview-modal__close',    modal).addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    /* Watch the body for QV HTML and wire up panel interactivity */
    var bodyEl = qs('.quickview-modal__body', modal);
    new MutationObserver(function () {
      var panel = qs('.qv', bodyEl);
      if (panel) initQuickViewPanel(panel);
    }).observe(bodyEl, { childList: true });
  }

  function openModal(html) {
    var modal = qs('#card-quickview-modal');
    if (!modal) return;
    qs('.quickview-modal__body', modal).innerHTML = html;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    qs('.quickview-modal__close', modal).focus();
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
      openModal('<div class="quickview-modal__loading" aria-live="polite">Loading…</div>');

      fetch('/products/' + handle + '?view=quickview&sections=product-quickview', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) {
          if (!data || !data['product-quickview']) {
            body.innerHTML =
              '<div style="padding:2rem;text-align:center">' +
                '<p style="margin:0 0 1rem;font-size:0.9rem;color:#555">Preview unavailable.</p>' +
                '<a href="/products/' + handle + '" style="display:inline-flex;text-decoration:none">View product</a>' +
              '</div>';
            return;
          }
          body.innerHTML = data['product-quickview'];
        })
        .catch(function () {
          body.innerHTML = '<p style="padding:2rem;color:#c0392b">Unable to load preview.</p>';
        });
    });
  }

  /* ──────────────────────────────────────────────────────────
     QUICK VIEW — panel interactivity
     Wired by the MutationObserver in buildModal() each time
     fresh QV HTML lands in .quickview-modal__body.
  ────────────────────────────────────────────────────────── */
  function initQuickViewPanel(wrap) {
    if (!wrap) return;

    var productId = wrap.getAttribute('data-product-id');

    /* Thumbnail switcher */
    var mainImg = wrap.querySelector('#qv-main-img');
    qsa('[data-qv-thumb]', wrap).forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        if (mainImg) {
          mainImg.src = thumb.getAttribute('data-src');
          mainImg.alt = thumb.getAttribute('data-alt') || '';
        }
        qsa('[data-qv-thumb]', wrap).forEach(function (t) { t.classList.remove('is-active'); });
        thumb.classList.add('is-active');
      });
    });

    /* Variant state — read from hidden <select> data attributes */
    var variantSelect = wrap.querySelector('[data-qv-variant-select]');
    var atcBtn        = wrap.querySelector('[data-atc-btn]');
    var priceEl       = productId ? wrap.querySelector('#qv-price-' + productId) : null;

    var variants = [];
    if (variantSelect) {
      qsa('option', variantSelect).forEach(function (opt) {
        variants.push({
          id:               parseInt(opt.value, 10),
          price:            parseInt(opt.getAttribute('data-price'),      10) || 0,
          compare_at_price: parseInt(opt.getAttribute('data-compare-at'), 10) || 0,
          available:        opt.getAttribute('data-available') === 'true',
          title:            opt.textContent.trim()
        });
      });
    }

    var selectedOptions = [];
    if (variantSelect) {
      var cur = variantSelect.options[variantSelect.selectedIndex];
      if (cur) selectedOptions = cur.textContent.trim().split(' / ');
    }

    function findVariant() {
      return variants.find(function (v) {
        var parts = v.title.split(' / ');
        return selectedOptions.every(function (val, i) { return parts[i] === val; });
      });
    }

    function updateUI(variant) {
      if (!variant) return;
      if (variantSelect) variantSelect.value = variant.id;
      if (atcBtn) {
        atcBtn.setAttribute('data-variant-id', variant.id);
        var label = qs('[data-atc-label]', atcBtn) || qs('.card-product__atc-label', atcBtn);
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
      if (priceEl) {
        var html = '';
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          html += '<s class="qv__price-compare">' + formatMoney(variant.compare_at_price) + '</s>';
          html += '<span class="qv__price-sale-badge">Save ' + formatMoney(variant.compare_at_price - variant.price) + '</span>';
        }
        html += '<span class="qv__price-current">' + formatMoney(variant.price) + '</span>';
        priceEl.innerHTML = html;
      }
    }

    /* Swatch / option-button clicks */
    wrap.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-qv-swatch], [data-qv-option-btn]');
      if (!btn) return;

      var optionIndex = parseInt(btn.getAttribute('data-option-index'), 10);
      var value       = btn.getAttribute('data-value');
      selectedOptions[optionIndex] = value;

      var group = btn.closest('[role="radiogroup"]');
      if (group) {
        qsa('[data-qv-swatch], [data-qv-option-btn]', group).forEach(function (b) {
          b.classList.remove('is-active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-checked', 'true');
      }

      var optionBlock   = btn.closest('.qv__option');
      var selectedLabel = optionBlock && qs('[data-qv-option-selected]', optionBlock);
      if (selectedLabel) selectedLabel.textContent = value;

      updateUI(findVariant());
    });
  }

  /* ── INIT ── */
  document.addEventListener('DOMContentLoaded', function () {
    initAddToCart();
    initWishlist();
    initCompare();
    initQuickView();
  });

  document.addEventListener('shopify:section:load', function (e) {
    syncWishlistButtons();
    syncCompareCheckboxes();
    renderCompareBar();
  });

})();
