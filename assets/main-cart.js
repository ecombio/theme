/**
 * main-cart.js
 * Fully self-contained script for sections/main-cart.liquid: handles
 * quantity changes, item removal, subtotal/badge refresh, and the product
 * recommendation rail on the full cart page. Does not depend on and does
 * not communicate with cart-drawer.js, cart-page.js, or
 * cart-recommendations.js — those can keep running independently for the
 * cart drawer elsewhere in the theme.
 *
 * Row and summary updates are rebuilt directly from the JSON returned by
 * Shopify's /cart/change.js and /cart/add.js endpoints, so this file never
 * needs to guess a Liquid section's rendered-section id.
 */

(() => {
  'use strict';

  const page = document.querySelector('[data-ecombio-cart-page]');
  if (!page) return;

  // ── Selectors ──────────────────────────────────────────────────────────────

  const TBODY_SEL      = '[data-ecombio-cart-tbody]';
  const QTY_SEL        = '[data-ecombio-page-qty-change]';
  const REMOVE_SEL     = '[data-ecombio-page-remove-item]';
  const LOADING_SEL    = '[data-ecombio-page-loading]';
  const SUBTOTAL_SEL   = '[data-ecombio-cart-subtotal]';
  const COUNT_SEL      = '[data-ecombio-cart-count]';
  const EMPTY_SEL      = '[data-ecombio-cart-empty]';
  const LAYOUT_SEL     = '[data-ecombio-cart-layout]';
  const RECS_SEL       = '[data-ecombio-recs]';
  const REC_ATC_SEL    = '[data-ecombio-rec-atc]';

  const LAST_ADDED_KEY = 'ecombio_last_added_product_id';

  // ── State ──────────────────────────────────────────────────────────────────

  let changeAbort   = null;
  let recsAbort     = null;
  let lastRecsSourceId = null;

  // ── Generic helpers ────────────────────────────────────────────────────────

  function escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatMoney(cents) {
    if (cents == null) return '';
    try {
      const currency = window.Shopify?.currency?.active ?? 'USD';
      return new Intl.NumberFormat(navigator.language, {
        style: 'currency', currency,
        minimumFractionDigits: 0, maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch (_) {
      return `$${(cents / 100).toFixed(2)}`;
    }
  }

  function getLoading() { return document.querySelector(LOADING_SEL); }

  function setLoading(on) {
    const overlay = getLoading();
    if (!overlay) return;

    if (on) {
      overlay.removeAttribute('hidden');
      overlay.setAttribute('aria-hidden', 'false');
      page.querySelectorAll(`${QTY_SEL}, ${REMOVE_SEL}`)
          .forEach((btn) => btn.setAttribute('disabled', ''));
    } else {
      overlay.setAttribute('hidden', '');
      overlay.setAttribute('aria-hidden', 'true');
      page.querySelectorAll(`${QTY_SEL}[disabled], ${REMOVE_SEL}[disabled]`)
          .forEach((btn) => btn.removeAttribute('disabled'));
    }
  }

  // ── Row rendering (from cart JSON, no section re-fetch needed) ────────────

  function buildRowHTML(item) {
    const hasVariant = item.variant_title && item.variant_title !== 'Default Title';
    const sellingPlanName = item.selling_plan_allocation?.selling_plan?.name;
    const showWasPrice = item.original_price !== item.final_price;
    const showWasLineTotal = item.original_line_price !== item.final_line_price;
    const imgSrc = item.image
      ? item.image.replace(/(\.[a-z]+)(\?|$)/i, '_200x200$1$2')
      : '';

    const minusIcon = item.quantity === 1
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

    const minusLabel = item.quantity === 1
      ? `Remove ${escapeHTML(item.product_title)} from cart`
      : `Decrease quantity of ${escapeHTML(item.product_title)}`;

    return `
      <tr class="ecombio-cart-page__row" data-cart-item-key="${item.key}" data-cart-product-id="${item.product_id}">
        <td class="ecombio-cart-page__td ecombio-cart-page__td--product">
          <div class="ecombio-cart-page__product">
            <a href="${escapeHTML(item.url)}" class="ecombio-cart-page__item-image-link" tabindex="-1" aria-hidden="true">
              ${imgSrc
                ? `<img src="${escapeHTML(imgSrc)}" alt="" width="100" height="100" loading="lazy" class="ecombio-cart-page__item-image">`
                : `<div class="ecombio-cart-page__item-image ecombio-cart-page__item-image--placeholder"></div>`}
            </a>
            <div class="ecombio-cart-page__item-meta">
              <a href="${escapeHTML(item.url)}" class="ecombio-cart-page__item-title">${escapeHTML(item.product_title)}</a>
              ${hasVariant ? `<p class="ecombio-cart-page__item-variant">${escapeHTML(item.variant_title)}</p>` : ''}
              ${sellingPlanName ? `<p class="ecombio-cart-page__item-selling-plan">${escapeHTML(sellingPlanName)}</p>` : ''}
            </div>
          </div>
        </td>
        <td class="ecombio-cart-page__td ecombio-cart-page__td--price" data-label="Price">
          ${showWasPrice ? `<s class="ecombio-cart-page__price--was">${formatMoney(item.original_price)}</s>` : ''}
          <span class="ecombio-cart-page__price">${formatMoney(item.final_price)}</span>
        </td>
        <td class="ecombio-cart-page__td ecombio-cart-page__td--qty" data-label="Quantity">
          <div class="ecombio-cart-page__qty" role="group" aria-label="Quantity for ${escapeHTML(item.product_title)}">
            <button type="button" class="ecombio-cart-page__qty-btn" data-ecombio-page-qty-change data-key="${item.key}" data-delta="-1" aria-label="${minusLabel}">${minusIcon}</button>
            <span class="ecombio-cart-page__qty-value" data-qty-value="${item.key}" aria-live="polite">${item.quantity}</span>
            <button type="button" class="ecombio-cart-page__qty-btn" data-ecombio-page-qty-change data-key="${item.key}" data-delta="1" aria-label="Increase quantity of ${escapeHTML(item.product_title)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
        </td>
        <td class="ecombio-cart-page__td ecombio-cart-page__td--total" data-label="Total">
          ${showWasLineTotal ? `<s class="ecombio-cart-page__price--was">${formatMoney(item.original_line_price)}</s>` : ''}
          <span class="ecombio-cart-page__price" data-line-price="${item.key}">${formatMoney(item.final_line_price)}</span>
        </td>
        <td class="ecombio-cart-page__td ecombio-cart-page__td--remove">
          <button type="button" class="ecombio-cart-page__remove" data-ecombio-page-remove-item data-key="${item.key}" aria-label="Remove ${escapeHTML(item.product_title)} from cart">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
          </button>
        </td>
      </tr>`;
  }

  function renderCart(cart) {
    // Toggle empty vs. layout blocks
    const emptyEl  = page.querySelector(EMPTY_SEL);
    const layoutEl = page.querySelector(LAYOUT_SEL);
    if (cart.item_count === 0) {
      emptyEl?.removeAttribute('hidden');
      layoutEl?.setAttribute('hidden', '');
      return; // nothing else to update once the layout is hidden
    }
    emptyEl?.setAttribute('hidden', '');
    layoutEl?.removeAttribute('hidden');

    // Rows
    const tbody = page.querySelector(TBODY_SEL);
    if (tbody) tbody.innerHTML = cart.items.map(buildRowHTML).join('');

    // Subtotal
    const subtotalEl = page.querySelector(SUBTOTAL_SEL);
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price);

    // Count badges (heading count + any other [data-ecombio-cart-count] on the page)
    page.querySelectorAll(COUNT_SEL).forEach((el) => {
      el.textContent = `(${cart.item_count})`;
      el.setAttribute('aria-label', `${cart.item_count} item${cart.item_count !== 1 ? 's' : ''} in cart`);
    });
  }

  // ── AJAX cart mutation ─────────────────────────────────────────────────────

  async function cartChange(key, quantity) {
    if (changeAbort) changeAbort.abort();
    changeAbort = new AbortController();
    setLoading(true);

    try {
      const res = await fetch('/cart/change.js', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: key, quantity }),
        signal:  changeAbort.signal,
      });
      if (!res.ok) throw new Error('Cart update failed');

      const cart = await res.json();
      renderCart(cart);
      invalidateRecs();
      loadRecommendations();

    } catch (err) {
      if (err.name !== 'AbortError') console.error('[EcombioCartPage] cartChange failed', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Event delegation: qty / remove ─────────────────────────────────────────

  page.addEventListener('click', (e) => {
    const qtyBtn = e.target.closest(QTY_SEL);
    if (qtyBtn) {
      const key     = qtyBtn.dataset.key;
      const valueEl = page.querySelector(`[data-qty-value="${key}"]`);
      const current = valueEl ? parseInt(valueEl.textContent, 10) : 1;
      cartChange(key, Math.max(0, current + parseInt(qtyBtn.dataset.delta, 10)));
      return;
    }

    const removeBtn = e.target.closest(REMOVE_SEL);
    if (removeBtn) {
      const row = removeBtn.closest('[data-cart-item-key]');
      if (row) row.classList.add('is-removing');
      cartChange(removeBtn.dataset.key, 0);
    }
  });

  // ── Recommendations (single instance — this page's own rail only) ─────────

  function getRecsEl() { return page.querySelector(RECS_SEL); }

  function getRecsSourceId() {
    const stored   = sessionStorage.getItem(LAST_ADDED_KEY);
    const fallback = page.querySelector('[data-cart-product-id]')?.dataset.cartProductId;
    const id = stored ?? fallback ?? null;

    if (id != null && !/^\d+$/.test(String(id))) {
      console.warn('[EcombioCartPage] recs source id is not numeric, ignoring:', id);
      return fallback && /^\d+$/.test(String(fallback)) ? fallback : null;
    }
    return id;
  }

  function getCartProductIds() {
    const ids = new Set();
    page.querySelectorAll('[data-cart-product-id]').forEach((el) => ids.add(el.dataset.cartProductId));
    return ids;
  }

  function invalidateRecs() { lastRecsSourceId = null; }

  async function fetchIntent(productId, intent, limit, signal) {
    const url = `/recommendations/products.json?product_id=${productId}&intent=${intent}&limit=${limit}`;
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) {
        let detail = '';
        try {
          const body = await res.json();
          detail = body?.description || body?.errors || JSON.stringify(body);
        } catch (_) { /* ignore non-JSON body */ }
        console.error(
          `[EcombioCartPage] recommendations fetch failed: ${res.status} ${res.statusText} ` +
          `(intent=${intent}, product_id=${productId})${detail ? ` — ${detail}` : ''}`
        );
        return [];
      }
      return (await res.json()).products ?? [];
    } catch (err) {
      if (err.name !== 'AbortError') console.error(`[EcombioCartPage] recs fetch failed intent=${intent}`, err);
      return [];
    }
  }

  function showSkeleton(shell) {
    shell.innerHTML = `
      <span class="ecombio-cart-recs__status" role="status" aria-live="polite" aria-atomic="true"></span>
      <div class="ecombio-cart-recs__skeleton" aria-hidden="true">
        <div class="ecombio-cart-recs__skeleton-bar"></div>
        <div class="ecombio-cart-recs__skeleton-cards">
          <div class="ecombio-cart-recs__skeleton-card"></div>
          <div class="ecombio-cart-recs__skeleton-card"></div>
          <div class="ecombio-cart-recs__skeleton-card"></div>
          <div class="ecombio-cart-recs__skeleton-card"></div>
        </div>
      </div>`;
  }

  function announce(shell, message) {
    const el = shell.querySelector('.ecombio-cart-recs__status');
    if (el) el.textContent = message;
  }

  const NAV_ICON_PREV = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
  const NAV_ICON_NEXT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

  function buildRail(label, products, intent) {
    const cards = products.map((p) => buildCard(p, intent)).filter(Boolean).join('');
    if (!cards) return '';
    const safeLabel = escapeHTML(label);
    return `
      <div class="ecombio-cart-recs__rail" data-intent="${intent}">
        <h3 class="ecombio-cart-recs__heading">${safeLabel}</h3>
        <div class="ecombio-cart-recs__scroller">
          <button type="button" class="ecombio-cart-recs__nav ecombio-cart-recs__nav--prev" data-rec-nav="prev" aria-label="Scroll ${safeLabel} left">${NAV_ICON_PREV}</button>
          <ul class="ecombio-cart-recs__list" role="list">${cards}</ul>
          <button type="button" class="ecombio-cart-recs__nav ecombio-cart-recs__nav--next" data-rec-nav="next" aria-label="Scroll ${safeLabel} right">${NAV_ICON_NEXT}</button>
        </div>
      </div>`;
  }

  function wireRailNav(shell) {
    shell.querySelectorAll('.ecombio-cart-recs__rail').forEach((rail) => {
      const list    = rail.querySelector('.ecombio-cart-recs__list');
      const prevBtn = rail.querySelector('[data-rec-nav="prev"]');
      const nextBtn = rail.querySelector('[data-rec-nav="next"]');
      if (!list || !prevBtn || !nextBtn) return;

      const update = () => {
        const max        = Math.max(0, list.scrollWidth - list.clientWidth);
        const scrollable = max > 4;
        prevBtn.hidden = !scrollable;
        nextBtn.hidden = !scrollable;
        if (!scrollable) return;
        prevBtn.disabled = list.scrollLeft <= 2;
        nextBtn.disabled = list.scrollLeft >= max - 2;
      };

      const scrollByPage = (dir) => list.scrollBy({ left: list.clientWidth * 0.9 * dir, behavior: 'smooth' });

      prevBtn.addEventListener('click', () => scrollByPage(-1));
      nextBtn.addEventListener('click', () => scrollByPage(1));
      list.addEventListener('scroll', update, { passive: true });
      new ResizeObserver(update).observe(list);
      update();
    });
  }

  function buildCard(product, intent) {
    const variant = product.variants?.[0];
    if (!variant) return '';

    const available      = variant.available;
    const isMultiVariant = product.variants.length > 1;

    const rawUrl  = product.url ?? '';
    const safeUrl = rawUrl.startsWith('/') || rawUrl.startsWith('https://') ? rawUrl : '#';

    const rawFeaturedImage =
      (typeof product.featured_image === 'string' && product.featured_image) ||
      product.featured_image?.src ||
      product.images?.[0]?.src ||
      product.images?.[0] ||
      null;

    const imgSrc = rawFeaturedImage ? rawFeaturedImage.replace(/(\.[a-z]+)(\?|$)/i, '_160x160$1$2') : '';
    const imgAlt = escapeHTML(product.images?.[0]?.alt || product.title);

    const price     = formatMoney(variant.price);
    const compPrice = variant.compare_at_price > variant.price ? formatMoney(variant.compare_at_price) : null;

    return `
      <li class="ecombio-cart-recs__card" data-product-id="${product.id}">
        <a href="${escapeHTML(safeUrl)}" class="ecombio-cart-recs__card-image-link" tabindex="-1" aria-hidden="true">
          ${imgSrc
            ? `<img src="${escapeHTML(imgSrc)}" alt="${imgAlt}" width="120" height="120" loading="lazy" class="ecombio-cart-recs__card-image">`
            : `<div class="ecombio-cart-recs__card-image ecombio-cart-recs__card-image--placeholder"></div>`}
        </a>
        <div class="ecombio-cart-recs__card-info">
          <a href="${escapeHTML(safeUrl)}" class="ecombio-cart-recs__card-title">${escapeHTML(product.title)}</a>
          ${isMultiVariant ? `<p class="ecombio-cart-recs__card-variant">${escapeHTML(variant.title)}</p>` : ''}
          <div class="ecombio-cart-recs__card-bottom">
            <div class="ecombio-cart-recs__card-price">
              ${compPrice ? `<s class="ecombio-cart-recs__price--was">${compPrice}</s>` : ''}
              <span class="ecombio-cart-recs__price">${price}</span>
            </div>
            <button type="button" class="ecombio-cart-recs__atc" data-ecombio-rec-atc data-variant-id="${variant.id}" data-product-id="${product.id}" data-intent="${intent}" aria-label="Add ${escapeHTML(product.title)} to cart" ${available ? '' : 'disabled'}>${available ? 'Add' : 'Sold out'}</button>
          </div>
        </div>
      </li>`;
  }

  async function loadRecommendations() {
    const shell = getRecsEl();
    if (!shell) return;

    const productId = getRecsSourceId();
    if (!productId) { shell.innerHTML = ''; lastRecsSourceId = null; return; }

    const showRelated        = shell.dataset.showRelated        === 'true';
    const showComplementary  = shell.dataset.showComplementary  === 'true';
    const limit               = Math.min(Math.max(parseInt(shell.dataset.recLimit, 10) || 4, 1), 10);
    const relatedLabel       = shell.dataset.relatedLabel;
    const complementaryLabel = shell.dataset.complementaryLabel;

    if (!showRelated && !showComplementary) { shell.innerHTML = ''; return; }

    if (recsAbort) recsAbort.abort();
    recsAbort = new AbortController();
    const { signal } = recsAbort;

    showSkeleton(shell);

    try {
      const [related, complementary] = await Promise.all([
        showRelated       ? fetchIntent(productId, 'related',       limit, signal) : Promise.resolve([]),
        showComplementary ? fetchIntent(productId, 'complementary', limit, signal) : Promise.resolve([]),
      ]);

      const inCart          = getCartProductIds();
      const filter          = (ps) => ps.filter((p) => !inCart.has(String(p.id)));
      const filteredRelated = filter(related);
      const filteredComp    = filter(complementary);

      if (!filteredRelated.length && !filteredComp.length) {
        shell.innerHTML = '';
        lastRecsSourceId = productId;
        return;
      }

      const rails = [];
      if (showRelated && filteredRelated.length)   rails.push(buildRail(relatedLabel, filteredRelated, 'related'));
      if (showComplementary && filteredComp.length) rails.push(buildRail(complementaryLabel, filteredComp, 'complementary'));
      shell.innerHTML = `<span class="ecombio-cart-recs__status" role="status" aria-live="polite" aria-atomic="true"></span>${rails.join('')}`;
      wireRailNav(shell);
      announce(shell, 'Product recommendations loaded.');
      lastRecsSourceId = productId;

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[EcombioCartPage] loadRecommendations failed', err);
        shell.innerHTML = '';
      }
    }
  }

  async function recAddToCart(btn) {
    if (!btn.dataset.variantId || btn.disabled) return;

    btn.disabled = true;
    btn.classList.add('is-loading');

    try {
      const res = await fetch('/cart/add.js', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: btn.dataset.variantId, quantity: 1 }),
      });
      if (!res.ok) throw new Error('ATC failed');
      await res.json();

      sessionStorage.setItem(LAST_ADDED_KEY, btn.dataset.productId);

      btn.classList.remove('is-loading');
      btn.classList.add('is-added');
      btn.textContent = '✓';

      // Refresh the table/summary/badges and reload recs from the fresh cart state
      const cart = await (await fetch('/cart.js')).json();
      renderCart(cart);
      invalidateRecs();
      loadRecommendations();

      setTimeout(() => {
        if (!btn.isConnected) return;
        btn.classList.remove('is-added');
        btn.textContent = 'Add';
        btn.disabled = false;
      }, 2000);

    } catch (err) {
      console.error('[EcombioCartPage] rec ATC failed', err);
      btn.classList.remove('is-loading');
      btn.textContent = 'Error';
      setTimeout(() => {
        if (!btn.isConnected) return;
        btn.textContent = 'Add';
        btn.disabled = false;
      }, 2000);
    }
  }

  page.addEventListener('click', (e) => {
    const btn = e.target.closest(REC_ATC_SEL);
    if (btn) recAddToCart(btn);
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  loadRecommendations();

})();