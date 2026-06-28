/**

 * ecombio-cart-drawer.js

 * Handles open/close, quantity updates, item removal, subtotal refresh,

 * and product recommendations via Shopify Product Recommendations API.

 *

 * Changelog vs v1:

 *  - Race condition fixed: AbortController cancels in-flight cartChange requests

 *  - Qty/remove buttons disabled during in-flight requests (second guard)

 *  - formatMoney removed from subtotal path — Liquid owns that via re-render

 *  - Two keydown listeners merged into one

 *  - data-remove-on-zero removed (qty→0 triggers removal natively)

 *  - Recommendations: parallel fetch of related + complementary rails

 *  - Rec cards filtered against current cart contents before rendering

 *  - ATC from rec cards with optimistic confirmed state + cart:updated bridge

 *  - recsRendered flag prevents redundant fetches within one open session

 */

(() => {

  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────

  const DRAWER_ID     = 'ecombio-cart-drawer';

  const OPEN_CLASS    = 'is-open';

  const LOADING_CLASS = 'is-loading';

  const LOCK_CLASS    = 'cart-drawer-open';

  const TRIGGER_SEL   = '[data-ecombio-cart-trigger]';

  const CLOSE_SEL     = '[data-ecombio-cart-close]';

  const QTY_SEL       = '[data-ecombio-qty-change]';

  const REMOVE_SEL    = '[data-ecombio-remove-item]';

  const BODY_SEL      = '[data-ecombio-cart-body]';

  const FOOTER_SEL    = '[data-ecombio-cart-footer]';

  const COUNT_SEL     = '[data-ecombio-cart-count]';

  const LOADING_SEL   = '[data-ecombio-cart-loading]';

  const RECS_SEL      = '[data-ecombio-recs]';

  const REC_ATC_SEL   = '[data-ecombio-rec-atc]';

  // sessionStorage key written by your ATC flow (product-card.js etc.)

  // Falls back to first cart item's data-cart-product-id if not present.

  const LAST_ADDED_KEY = 'ecombio_last_added_product_id';

  // ── State ──────────────────────────────────────────────────────────────────

  let lastTrigger     = null;

  let cartChangeAbort = null;  // AbortController for in-flight cartChange

  let recsAbort       = null;  // AbortController for in-flight rec fetches

  let recsRendered    = false; // true = recs are current, skip re-fetch on open

  // ── Drawer helpers ─────────────────────────────────────────────────────────

  function getDrawer() {

    return document.getElementById(DRAWER_ID);

  }

  function isOpen() {

    return getDrawer()?.classList.contains(OPEN_CLASS) ?? false;

  }

  function openDrawer() {

    const drawer = getDrawer();

    if (!drawer) return;

    drawer.removeAttribute('hidden');

    drawer.setAttribute('aria-hidden', 'false');

    drawer.classList.add(OPEN_CLASS);

    document.documentElement.classList.add(LOCK_CLASS);

    // Fetch recommendations on open if cart has changed since last fetch

    if (!recsRendered) {

      loadRecommendations();

    }

    requestAnimationFrame(() => {

      const focusable = getFocusable(drawer);

      if (focusable.length) focusable[0].focus();

    });

  }

  function closeDrawer() {

    const drawer = getDrawer();

    if (!drawer) return;

    drawer.setAttribute('hidden', '');

    drawer.setAttribute('aria-hidden', 'true');

    drawer.classList.remove(OPEN_CLASS);

    document.documentElement.classList.remove(LOCK_CLASS);

    if (lastTrigger) lastTrigger.focus();

  }

  // ── Focus helpers ──────────────────────────────────────────────────────────

  function getFocusable(container) {

    return Array.from(container.querySelectorAll(

      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    ));

  }

  // ── Loading state ──────────────────────────────────────────────────────────

  function setLoading(on) {

    const drawer  = getDrawer();

    const overlay = drawer?.querySelector(LOADING_SEL);

    if (!drawer || !overlay) return;

    if (on) {

      overlay.removeAttribute('hidden');

      overlay.setAttribute('aria-hidden', 'false');

      drawer.classList.add(LOADING_CLASS);

      // Disable interactive cart controls to prevent race conditions

      drawer.querySelectorAll(`${QTY_SEL}, ${REMOVE_SEL}`).forEach((btn) => {

        btn.setAttribute('disabled', '');

      });

    } else {

      overlay.setAttribute('hidden', '');

      overlay.setAttribute('aria-hidden', 'true');

      drawer.classList.remove(LOADING_CLASS);

      drawer.querySelectorAll(`${QTY_SEL}[disabled], ${REMOVE_SEL}[disabled]`).forEach((btn) => {

        btn.removeAttribute('disabled');

      });

    }

  }

  // ── Cart AJAX ──────────────────────────────────────────────────────────────

  async function cartChange(key, quantity) {

    // Cancel any previous in-flight mutation — last click wins

    if (cartChangeAbort) cartChangeAbort.abort();

    cartChangeAbort = new AbortController();

    setLoading(true);

    try {

      const res = await fetch('/cart/change.js', {

        method:  'POST',

        headers: { 'Content-Type': 'application/json' },

        body:    JSON.stringify({ id: key, quantity }),

        signal:  cartChangeAbort.signal,

      });

      if (!res.ok) throw new Error('Cart update failed');

      const cart = await res.json();

      // Re-render body + footer from Liquid section render

      await refreshDrawerHTML();

      // Update count badges only — subtotal is owned by Liquid after re-render

      updateCountBadges(cart.item_count);

      // Invalidate recs: cart changed, source product may have changed

      recsRendered = false;

      // Immediately refresh recs if the drawer is still open

      if (isOpen()) loadRecommendations();

    } catch (err) {

      if (err.name === 'AbortError') return; // intentional cancel, not an error

      console.error('[EcombioCart] cartChange failed', err);

    } finally {

      setLoading(false);

    }

  }

  async function refreshDrawerHTML() {

    try {

      const res = await fetch('/?section_id=cart-drawer', {

        headers: { 'X-Requested-With': 'XMLHttpRequest' },

      });

      if (!res.ok) return;

      const text = await res.text();

      const doc  = new DOMParser().parseFromString(text, 'text/html');

      // Swap body

      const newBody  = doc.querySelector(BODY_SEL);

      const curBody  = document.querySelector(BODY_SEL);

      if (newBody && curBody) curBody.innerHTML = newBody.innerHTML;

      // Swap footer (preserve hidden state)

      const newFooter = doc.querySelector(FOOTER_SEL);

      const curFooter = document.querySelector(FOOTER_SEL);

      if (newFooter && curFooter) {

        curFooter.innerHTML = newFooter.innerHTML;

        newFooter.hasAttribute('hidden')

          ? curFooter.setAttribute('hidden', '')

          : curFooter.removeAttribute('hidden');

      }

    } catch (err) {

      console.error('[EcombioCart] HTML refresh failed', err);

    }

  }

  function updateCountBadges(itemCount) {

    document.querySelectorAll(COUNT_SEL).forEach((el) => {

      const isParens = el.textContent.trim().startsWith('(');

      el.textContent = isParens ? `(${itemCount})` : itemCount;

      el.setAttribute('aria-label', `${itemCount} item${itemCount !== 1 ? 's' : ''} in cart`);

    });

  }

  // ── Product Recommendations ────────────────────────────────────────────────

  /**

   * Resolve the source product ID for recommendations.

   * Priority: sessionStorage (last ATC) → first cart item data attribute.

   * The data-cart-product-id attribute is set on each <li> in the Liquid.

   */

  function getRecsSourceId() {

    const fromSession = sessionStorage.getItem(LAST_ADDED_KEY);

    if (fromSession) return fromSession;

    const firstItem = document.querySelector('[data-cart-product-id]');

    return firstItem?.dataset.cartProductId ?? null;

  }

  /**

   * Fetch one recommendation intent. Returns [] on any failure so callers

   * treat "no results" and "error" identically — both render nothing.

   */

  async function fetchIntent(productId, intent, limit, signal) {

    const url = `/recommendations/products.json?product_id=${productId}&intent=${intent}&limit=${limit}`;

    try {

      const res = await fetch(url, { signal });

      if (!res.ok) return [];

      const data = await res.json();

      return data.products ?? [];

    } catch (err) {

      if (err.name !== 'AbortError') {

        console.error(`[EcombioRecs] fetch failed intent=${intent}`, err);

      }

      return [];

    }

  }

  /**

   * Main orchestrator. Reads config from drawer data-* attributes (written

   * from Liquid schema settings), fetches both intents in parallel, filters

   * out products already in the cart, then renders.

   */

  async function loadRecommendations() {

    const drawer    = getDrawer();

    const recsShell = drawer?.querySelector(RECS_SEL);

    if (!recsShell) return; // recs disabled in schema or cart is empty

    const productId = getRecsSourceId();

    if (!productId) {

      recsShell.innerHTML = '';

      return;

    }

    const showRelated        = drawer.dataset.showRelated        === 'true';

    const showComplementary  = drawer.dataset.showComplementary  === 'true';

    const limit              = parseInt(drawer.dataset.recLimit, 10) || 4;

    const relatedLabel       = recsShell.dataset.relatedLabel;

    const complementaryLabel = recsShell.dataset.complementaryLabel;

    if (!showRelated && !showComplementary) {

      recsShell.innerHTML = '';

      return;

    }

    // Cancel any previous in-flight recs fetch

    if (recsAbort) recsAbort.abort();

    recsAbort = new AbortController();

    const { signal } = recsAbort;

    // Show skeleton while loading (only if no real content is present yet)

    showRecsSkeleton(recsShell);

    try {

      // Fetch both intents in parallel — disabled intents resolve immediately

      const [related, complementary] = await Promise.all([

        showRelated       ? fetchIntent(productId, 'related',       limit, signal) : Promise.resolve([]),

        showComplementary ? fetchIntent(productId, 'complementary', limit, signal) : Promise.resolve([]),

      ]);

      // Remove products already in the cart from both rails

      const inCart = getCartProductIds();

      const filter = (products) => products.filter((p) => !inCart.has(String(p.id)));

      const filteredRelated       = filter(related);

      const filteredComplementary = filter(complementary);

      if (!filteredRelated.length && !filteredComplementary.length) {

        recsShell.innerHTML = '';

        recsRendered = true;

        return;

      }

      renderRecs(recsShell, {

        related:       { products: filteredRelated,       label: relatedLabel,       intent: 'related' },

        complementary: { products: filteredComplementary, label: complementaryLabel, intent: 'complementary' },

        showRelated,

        showComplementary,

      });

      recsRendered = true;

    } catch (err) {

      if (err.name !== 'AbortError') {

        console.error('[EcombioRecs] loadRecommendations failed', err);

        recsShell.innerHTML = '';

      }

    }

  }

  /** Returns a Set of product ID strings for every item currently in the cart DOM. */

  function getCartProductIds() {

    const ids = new Set();

    document.querySelectorAll('[data-cart-product-id]').forEach((el) => {

      ids.add(el.dataset.cartProductId);

    });

    return ids;

  }

  function showRecsSkeleton(shell) {

    // Only inject skeleton if no real rail content is rendered yet

    if (shell.querySelector('.ecombio-cart-recs__rail')) return;

    shell.innerHTML = `

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

  function renderRecs(shell, { related, complementary, showRelated, showComplementary }) {

    const rails = [];

    if (showRelated       && related.products.length)       rails.push(buildRail(related.label,       related.products,       'related'));

    if (showComplementary && complementary.products.length) rails.push(buildRail(complementary.label, complementary.products, 'complementary'));

    shell.innerHTML = rails.length ? rails.join('') : '';

  }

  function buildRail(label, products, intent) {

    const cards = products.map((p) => buildCard(p, intent)).filter(Boolean).join('');

    if (!cards) return '';

    return `

      <div class="ecombio-cart-recs__rail" data-intent="${intent}">

        <h3 class="ecombio-cart-recs__heading">${escapeHTML(label)}</h3>

        <ul class="ecombio-cart-recs__list" role="list">

          ${cards}

        </ul>

      </div>`;

  }

  function buildCard(product, intent) {

    const variant = product.variants?.[0];

    if (!variant) return '';

    const variantId      = variant.id;

    const available      = variant.available;

    const isMultiVariant = product.variants.length > 1;

    // Resize the featured image URL to 160px (2× for HiDPI) via Shopify CDN pattern

    const img    = product.featured_image;

    const imgSrc = img?.url

      ? img.url.replace(/(\.[a-z]+)(\?|$)/, '_160x160$1$2')

      : '';

    const imgAlt = img?.alt ? escapeHTML(img.alt) : escapeHTML(product.title);

    const price     = formatShopifyMoney(variant.price);

    const compPrice = variant.compare_at_price && variant.compare_at_price > variant.price

      ? formatShopifyMoney(variant.compare_at_price)

      : null;

    const variantMeta = isMultiVariant

      ? `<p class="ecombio-cart-recs__card-variant">${escapeHTML(variant.title)}</p>`

      : '';

    return `

      <li class="ecombio-cart-recs__card" data-product-id="${product.id}">

        <a

          href="${escapeHTML(product.url)}"

          class="ecombio-cart-recs__card-image-link"

          tabindex="-1"

          aria-hidden="true"

        >

          ${imgSrc

            ? `<img

                src="${escapeHTML(imgSrc)}"

                alt="${imgAlt}"

                width="120"

                height="120"

                loading="lazy"

                class="ecombio-cart-recs__card-image"

              >`

            : `<div class="ecombio-cart-recs__card-image ecombio-cart-recs__card-image--placeholder"></div>`

          }

        </a>

        <div class="ecombio-cart-recs__card-info">

          <a href="${escapeHTML(product.url)}" class="ecombio-cart-recs__card-title">

            ${escapeHTML(product.title)}

          </a>

          ${variantMeta}

          <div class="ecombio-cart-recs__card-bottom">

            <div class="ecombio-cart-recs__card-price">

              ${compPrice ? `<s class="ecombio-cart-recs__price--was">${compPrice}</s>` : ''}

              <span class="ecombio-cart-recs__price">${price}</span>

            </div>

            <button

              type="button"

              class="ecombio-cart-recs__atc"

              data-ecombio-rec-atc

              data-variant-id="${variantId}"

              data-product-id="${product.id}"

              data-intent="${intent}"

              aria-label="Add ${escapeHTML(product.title)} to cart"

              ${available ? '' : 'disabled'}

            >${available ? 'Add' : 'Sold out'}</button>

          </div>

        </div>

      </li>`;

  }

  /**

   * Format money for rec card prices only.

   * Cart totals always come from Liquid (money_with_currency) — never JS.

   * Uses Intl.NumberFormat for correct locale/currency formatting.

   */

  function formatShopifyMoney(cents) {

    if (cents == null) return '';

    try {

      const currency = window.Shopify?.currency?.active ?? 'USD';

      return new Intl.NumberFormat(navigator.language, {

        style:                 'currency',

        currency:              currency,

        minimumFractionDigits: 0,

        maximumFractionDigits: 2,

      }).format(cents / 100);

    } catch (_) {

      return `$${(cents / 100).toFixed(2)}`;

    }

  }

  function escapeHTML(str) {

    return String(str ?? '')

      .replace(/&/g, '&amp;')

      .replace(/</g, '&lt;')

      .replace(/>/g, '&gt;')

      .replace(/"/g, '&quot;')

      .replace(/'/g, '&#39;');

  }

  // ── Rec card: Add to Cart ──────────────────────────────────────────────────

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

      // Record last-added so recs use this product as their source

      sessionStorage.setItem(LAST_ADDED_KEY, btn.dataset.productId);

      // Confirmed state

      btn.classList.remove('is-loading');

      btn.classList.add('is-added');

      btn.textContent = '✓';

      // Refresh drawer + badges via existing event bridge

      document.dispatchEvent(new CustomEvent('cart:updated'));

      // Reset button after 2 s

      setTimeout(() => {

        if (!btn.isConnected) return; // card may have been removed by re-render

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

    // Open trigger

    const trigger = e.target.closest(TRIGGER_SEL);

    if (trigger) {

      lastTrigger = trigger;

      isOpen() ? closeDrawer() : openDrawer();

      return;

    }

    // Close (backdrop, close button, continue shopping links)

    if (e.target.closest(CLOSE_SEL)) {

      closeDrawer();

      return;

    }

    // Quantity stepper

    const qtyBtn = e.target.closest(QTY_SEL);

    if (qtyBtn) {

      const key     = qtyBtn.dataset.key;

      const delta   = parseInt(qtyBtn.dataset.delta, 10);

      const valueEl = document.querySelector(`[data-qty-value="${key}"]`);

      const current = valueEl ? parseInt(valueEl.textContent, 10) : 1;

      cartChange(key, Math.max(0, current + delta));

      return;

    }

    // Remove item

    const removeBtn = e.target.closest(REMOVE_SEL);

    if (removeBtn) {

      cartChange(removeBtn.dataset.key, 0);

      return;

    }

    // Rec card: Add to cart

    const recAtcBtn = e.target.closest(REC_ATC_SEL);

    if (recAtcBtn) {

      recAddToCart(recAtcBtn);

      return;

    }

    // Backdrop click — close if click landed outside the inner panel

    const drawer = getDrawer();

    if (drawer && isOpen()) {

      const inner = drawer.querySelector('.ecombio-cart-drawer__inner');

      if (inner && !inner.contains(e.target)) closeDrawer();

    }

  });

  // ── Keyboard — single listener for Escape + Tab trap ──────────────────────

  document.addEventListener('keydown', (e) => {

    if (!isOpen()) return;

    if (e.key === 'Escape') {

      closeDrawer();

      return;

    }

    if (e.key === 'Tab') {

      const drawer    = getDrawer();

      const focusable = getFocusable(drawer);

      if (!focusable.length) return;

      const first = focusable[0];

      const last  = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {

        e.preventDefault();

        last.focus();

      } else if (!e.shiftKey && document.activeElement === last) {

        e.preventDefault();

        first.focus();

      }

    }

  });

  // ── Cart event bridge ──────────────────────────────────────────────────────

  document.addEventListener('cart:open', openDrawer);

  document.addEventListener('cart:updated', async () => {

    recsRendered = false; // cart changed — recs need a fresh fetch

    await refreshDrawerHTML();

    try {

      const res  = await fetch('/cart.js');

      const cart = await res.json();

      updateCountBadges(cart.item_count);

    } catch (err) {

      console.error('[EcombioCart] badge refresh failed', err);

    }

    if (isOpen()) loadRecommendations();

  });

  // ── Public API ─────────────────────────────────────────────────────────────

  window.EcombioCart = {

    open:    openDrawer,

    close:   closeDrawer,

    toggle:  () => (isOpen() ? closeDrawer() : openDrawer()),

    refresh: refreshDrawerHTML,

  };

})();