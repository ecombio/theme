/**
 * cart-recommendations.js
 * Fetches, filters, and renders product recommendation rails inside the
 * cart drawer via Shopify's Product Recommendations API.
 *
 * Depends on:
 *   - cart-drawer.js  (dispatches 'cart:drawer:open' and 'cart:updated')
 *   - #ecombio-cart-drawer[data-show-related][data-show-complementary][data-rec-limit]
 *   - [data-ecombio-recs][data-related-label][data-complementary-label]
 *
 * Source product resolution:
 *   Priority 1 → sessionStorage key 'ecombio_last_added_product_id'
 *   Priority 2 → first [data-cart-product-id] in the drawer DOM
 *
 * Events dispatched:
 *   'cart:rec:added'  — after a rec ATC succeeds; detail: { itemCount }
 *                       cart-drawer.js listens to this for HTML + badge refresh.
 *
 * Events consumed:
 *   'cart:drawer:open' — fetch recs if source or cart has changed
 *   'cart:updated'     — invalidate and re-fetch if drawer is open
 *
 * Shopify Recommendations API reference (fetchIntent):
 *   GET /recommendations/products.json?product_id=&intent=&limit=
 *   422 → missing/invalid product_id or intent
 *   404 → product_id doesn't resolve to a published product on this channel
 *         (classic cause: a variant ID was passed instead of a product ID)
 *   See: https://shopify.dev/docs/api/ajax/reference/product-recommendations
 */

(() => {
  'use strict';

  const DRAWER_ID      = 'ecombio-cart-drawer';
  const RECS_SEL       = '[data-ecombio-recs]';
  const REC_ATC_SEL    = '[data-ecombio-rec-atc]';
  const LAST_ADDED_KEY = 'ecombio_last_added_product_id';

  let recsAbort      = null;
  let lastSourceId   = null; // track source so we can detect staleness on open

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getDrawer = () => document.getElementById(DRAWER_ID);

  function getRecsSourceId() {
    const stored = sessionStorage.getItem(LAST_ADDED_KEY);
    const fallback = document.querySelector('[data-cart-product-id]')?.dataset.cartProductId;
    const id = stored ?? fallback ?? null;

    // Defensive: product IDs are numeric. If something wrote a non-numeric
    // or empty string into sessionStorage, fall through instead of sending
    // a request Shopify will 422 or 404 on.
    if (id != null && !/^\d+$/.test(String(id))) {
      console.warn('[EcombioRecs] source id is not a plain numeric product id, ignoring:', id);
      return fallback && /^\d+$/.test(String(fallback)) ? fallback : null;
    }
    return id;
  }

  function getCartProductIds() {
    const ids = new Set();
    document.querySelectorAll('[data-cart-product-id]')
            .forEach((el) => ids.add(el.dataset.cartProductId));
    return ids;
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchIntent(productId, intent, limit, signal) {
    const url = `/recommendations/products.json?product_id=${productId}&intent=${intent}&limit=${limit}`;
    try {
      const res = await fetch(url, { signal });

      if (!res.ok) {
        // Surface *why* Shopify rejected the request instead of silently
        // returning []. Common causes: 422 (bad/missing product_id or
        // intent), 404 (product_id is a variant id, or the product isn't
        // published on the Online Store sales channel).
        let detail = '';
        try {
          const body = await res.json();
          detail = body?.description || body?.errors || JSON.stringify(body);
        } catch (_) { /* body wasn't JSON, ignore */ }
        console.error(
          `[EcombioRecs] recommendations fetch failed: ${res.status} ${res.statusText} ` +
          `(intent=${intent}, product_id=${productId})${detail ? ` — ${detail}` : ''}`
        );
        return [];
      }

      return (await res.json()).products ?? [];
    } catch (err) {
      if (err.name !== 'AbortError') console.error(`[EcombioRecs] fetch failed intent=${intent}`, err);
      return [];
    }
  }

  // ── Orchestrator ───────────────────────────────────────────────────────────

  async function loadRecommendations() {
    const drawer    = getDrawer();
    const recsShell = drawer?.querySelector(RECS_SEL);
    if (!recsShell) return;

    const productId = getRecsSourceId();
    if (!productId) { recsShell.innerHTML = ''; lastSourceId = null; return; }

    const showRelated        = drawer.dataset.showRelated        === 'true';
    const showComplementary  = drawer.dataset.showComplementary  === 'true';
    const limit               = Math.min(Math.max(parseInt(drawer.dataset.recLimit, 10) || 4, 1), 10);
    const relatedLabel       = recsShell.dataset.relatedLabel;
    const complementaryLabel = recsShell.dataset.complementaryLabel;

    if (!showRelated && !showComplementary) { recsShell.innerHTML = ''; return; }

    if (recsAbort) recsAbort.abort();
    recsAbort = new AbortController();
    const { signal } = recsAbort;

    // Always show skeleton during (re-)fetch so stale content isn't left behind
    showSkeleton(recsShell);

    try {
      const [related, complementary] = await Promise.all([
        showRelated       ? fetchIntent(productId, 'related',       limit, signal) : Promise.resolve([]),
        showComplementary ? fetchIntent(productId, 'complementary', limit, signal) : Promise.resolve([]),
      ]);

      const inCart             = getCartProductIds();
      const filter             = (ps) => ps.filter((p) => !inCart.has(String(p.id)));
      const filteredRelated    = filter(related);
      const filteredComplement = filter(complementary);

      if (!filteredRelated.length && !filteredComplement.length) {
        recsShell.innerHTML = '';
        lastSourceId = productId;
        return;
      }

      renderRecs(recsShell, {
        related:       { products: filteredRelated,    label: relatedLabel,       intent: 'related' },
        complementary: { products: filteredComplement, label: complementaryLabel, intent: 'complementary' },
        showRelated,
        showComplementary,
      });

      announce(recsShell, 'Product recommendations loaded.');
      lastSourceId = productId;

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[EcombioRecs] loadRecommendations failed', err);
        recsShell.innerHTML = '';
      }
    }
  }

  // ── Announce to screen readers ─────────────────────────────────────────────

  function announce(shell, message) {
    const el = shell.querySelector('.ecombio-cart-recs__status');
    if (el) el.textContent = message;
  }

  // ── Skeleton ───────────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderRecs(shell, { related, complementary, showRelated, showComplementary }) {
    const rails = [];
    if (showRelated      && related.products.length)       rails.push(buildRail(related.label,       related.products,      'related'));
    if (showComplementary && complementary.products.length) rails.push(buildRail(complementary.label, complementary.products, 'complementary'));
    shell.innerHTML = `<span class="ecombio-cart-recs__status" role="status" aria-live="polite" aria-atomic="true"></span>${rails.join('')}`;
    wireRailNav(shell);
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
          <button
            type="button"
            class="ecombio-cart-recs__nav ecombio-cart-recs__nav--prev"
            data-rec-nav="prev"
            aria-label="Scroll ${safeLabel} left"
          >${NAV_ICON_PREV}</button>
          <ul class="ecombio-cart-recs__list" role="list">${cards}</ul>
          <button
            type="button"
            class="ecombio-cart-recs__nav ecombio-cart-recs__nav--next"
            data-rec-nav="next"
            aria-label="Scroll ${safeLabel} right"
          >${NAV_ICON_NEXT}</button>
        </div>
      </div>`;
  }

  /**
   * Wires up prev/next scroll buttons for every rail in the shell.
   * Buttons stay visible but are disabled + greyed out at the start/end of
   * scroll, and hidden entirely when a rail's cards all fit without
   * scrolling (nothing to navigate). Re-evaluated on scroll and on resize
   * (ResizeObserver) so it stays correct if card images change the
   * scrollable width after load.
   */
  function wireRailNav(shell) {
    shell.querySelectorAll('.ecombio-cart-recs__rail').forEach((rail) => {
      const list    = rail.querySelector('.ecombio-cart-recs__list');
      const prevBtn = rail.querySelector('[data-rec-nav="prev"]');
      const nextBtn = rail.querySelector('[data-rec-nav="next"]');
      if (!list || !prevBtn || !nextBtn) return;

      const update = () => {
        const max        = Math.max(0, list.scrollWidth - list.clientWidth);
        const scrollable = max > 4; // fudge factor for sub-pixel rounding

        prevBtn.hidden = !scrollable;
        nextBtn.hidden = !scrollable;
        if (!scrollable) return;

        prevBtn.disabled = list.scrollLeft <= 2;
        nextBtn.disabled = list.scrollLeft >= max - 2;
      };

      const scrollByPage = (dir) => {
        list.scrollBy({ left: list.clientWidth * 0.9 * dir, behavior: 'smooth' });
      };

      prevBtn.addEventListener('click', () => scrollByPage(-1));
      nextBtn.addEventListener('click', () => scrollByPage(1));
      list.addEventListener('scroll', update, { passive: true });

      // scrollWidth can change once card images finish loading, so keep
      // re-checking via ResizeObserver rather than a single call.
      new ResizeObserver(update).observe(list);

      update();
    });
  }

  function buildCard(product, intent) {
    const variant = product.variants?.[0];
    if (!variant) return '';

    const available      = variant.available;
    const isMultiVariant = product.variants.length > 1;

    // Use product.url as returned by Shopify — it carries recommendation
    // tracking params (ref=...) that feed the recommendation-performance
    // reporting in Shopify Analytics. Don't strip or rebuild it.
    const rawUrl = product.url ?? '';
    const safeUrl = rawUrl.startsWith('/') || rawUrl.startsWith('https://') ? rawUrl : '#';

    // Shopify's product JSON (including the recommendations endpoint) returns
    // product-level featured_image as a plain URL STRING, not an object —
    // { url, alt } only applies at the variant level, and even there the
    // field is `.src`, not `.url`. Handle all three shapes defensively:
    //   1. product.featured_image as a string  (the common case)
    //   2. product.featured_image as an object with .src
    //   3. fallback to the first entry in product.images[]
    const rawFeaturedImage =
      (typeof product.featured_image === 'string' && product.featured_image) ||
      product.featured_image?.src ||
      product.images?.[0]?.src ||
      product.images?.[0] || // some endpoints return images[] as plain strings too
      null;

    const imgSrc = rawFeaturedImage
      ? rawFeaturedImage.replace(/(\.[a-z]+)(\?|$)/i, '_160x160$1$2')
      : '';
    const imgAlt = escapeHTML(product.images?.[0]?.alt || product.title);

    const price     = formatMoney(variant.price);
    const compPrice = variant.compare_at_price > variant.price
      ? formatMoney(variant.compare_at_price)
      : null;

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
            <button
              type="button"
              class="ecombio-cart-recs__atc"
              data-ecombio-rec-atc
              data-variant-id="${variant.id}"
              data-product-id="${product.id}"
              data-intent="${intent}"
              aria-label="Add ${escapeHTML(product.title)} to cart"
              ${available ? '' : 'disabled'}
            >${available ? 'Add' : 'Sold out'}</button>
          </div>
        </div>
      </li>`;
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  function formatMoney(cents) {
    if (cents == null) return '';
    try {
      const currency = window.Shopify?.currency?.active ?? 'USD';
      if (!window.Shopify?.currency?.active) console.warn('[EcombioRecs] Shopify.currency not set, defaulting to USD');
      return new Intl.NumberFormat(navigator.language, {
        style: 'currency', currency,
        minimumFractionDigits: 0, maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch (_) {
      return `$${(cents / 100).toFixed(2)}`;
    }
  }

  function escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Rec Add to Cart ────────────────────────────────────────────────────────

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

      // Update last-added source for next recs cycle.
      // NOTE: this must stay a product id (btn.dataset.productId), not the
      // variant id used for the add-to-cart call — getRecsSourceId() expects
      // product-level ids, and the API 404s on variant ids.
      sessionStorage.setItem(LAST_ADDED_KEY, btn.dataset.productId);
      lastSourceId = null; // invalidate so next open re-fetches with new source

      // Confirmed state — show before HTML refresh wipes the button
      btn.classList.remove('is-loading');
      btn.classList.add('is-added');
      btn.textContent = '✓';

      // Fetch updated cart count then notify drawer (HTML refresh + badge only)
      const cart = await (await fetch('/cart.js')).json();
      document.dispatchEvent(new CustomEvent('cart:rec:added', { detail: { itemCount: cart.item_count } }));

      // Reset button — but if it's been detached by the HTML refresh, bail
      setTimeout(() => {
        if (!btn.isConnected) return;
        btn.classList.remove('is-added');
        btn.textContent = 'Add';
        btn.disabled = false;
      }, 2000);

    } catch (err) {
      console.error('[EcombioRecs] ATC failed', err);
      btn.classList.remove('is-loading');
      btn.textContent = 'Error';
      setTimeout(() => {
        if (!btn.isConnected) return;
        btn.textContent = 'Add';
        btn.disabled = false;
      }, 2000);
    }
  }

  // ── Event delegation ───────────────────────────────────────────────────────

  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest(REC_ATC_SEL);
    if (btn) recAddToCart(btn);
  });

  // ── Cart event listeners ───────────────────────────────────────────────────

  document.addEventListener('cart:drawer:open', () => {
    const currentSourceId = getRecsSourceId();
    // Re-fetch if source product changed or recs were invalidated
    if (currentSourceId !== lastSourceId) loadRecommendations();
  });

  document.addEventListener('cart:updated', () => {
    lastSourceId = null; // invalidate
    if (getDrawer()?.classList.contains('is-open')) loadRecommendations();
  });

})();