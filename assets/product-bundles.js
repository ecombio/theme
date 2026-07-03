/**
 * product-bundles.js
 * ------------------------------------------------------------------
 * Hydrates .ecombio-bundle-card skeletons with live product data,
 * and adds bundle contents to cart via a single atomic /cart/add.js
 * request (all line items in one call).
 *
 * Cart-drawer integration (best-effort, feature-detected):
 *  1. Dispatches document-level CustomEvents: "cart:add", "cart:refresh",
 *     "cart:error" -- with { detail: { cart, bundle } } -- for any
 *     drawer/listener that subscribes to these (common ecombio/Dawn-
 *     style convention).
 *  2. If a <cart-drawer> custom element exists in the DOM and exposes
 *     .open() / .renderContents(cart), those are called directly.
 *  3. If neither is present, falls back to refetching the
 *     `cart-drawer` section HTML (?section_id=cart-drawer) and
 *     swapping #CartDrawer innerHTML, if that element exists.
 *  All three are wrapped in try/catch with console.error logging so a
 *  missing integration point never breaks the add-to-cart flow itself.
 *
 * NOTE on data-bundle-items: the Liquid template embeds this JSON
 * blob HTML-escaped inside a double-quoted attribute. The browser
 * automatically un-escapes HTML entities when we read it via
 * element.dataset, so JSON.parse below receives clean JSON with no
 * extra decoding step needed on this side.
 * ------------------------------------------------------------------ */

(() => {
  'use strict';

  const SELECTORS = {
    card: '[data-ecombio-bundle-card]',
    skeleton: '[data-ecombio-skeleton]',
    content: '[data-ecombio-content]',
    itemsList: '[data-ecombio-items-list]',
    price: '[data-ecombio-bundle-price]',
    comparePrice: '[data-ecombio-bundle-compare-price]',
    savingsBadge: '[data-ecombio-savings-badge]',
    addBtn: '[data-ecombio-add-bundle-btn]',
    btnLabel: '[data-ecombio-btn-label]',
    btnSpinner: '[data-ecombio-btn-spinner]',
    errorEl: '[data-ecombio-bundle-error]',
  };

  const CART_EVENTS = {
    ADD: 'cart:add',
    REFRESH: 'cart:refresh',
    ERROR: 'cart:error',
    OPEN: 'cart:open',
  };

  const LOG_PREFIX = '[product-bundles]';

  // Tracks which card elements already have an EcombioBundleCard instance
  // wired up, so re-running initBundleCards() (e.g. from
  // shopify:section:load firing for an unrelated section on the same
  // page) never double-binds click listeners on the same button.
  const initializedCards = new WeakSet();

  /** Format a cents-based price using the shop's active currency, if Shopify.formatMoney is available. */
  function formatMoney(cents) {
    try {
      if (window.Shopify && typeof window.Shopify.formatMoney === 'function' && window.theme && window.theme.moneyFormat) {
        return window.Shopify.formatMoney(cents, window.theme.moneyFormat);
      }
    } catch (err) {
      console.error(LOG_PREFIX, 'formatMoney via Shopify.formatMoney failed, falling back to basic formatting', err);
    }
    // Fallback: basic USD-style formatting. Adjust if the shop's default currency differs.
    return `$${(cents / 100).toFixed(2)}`;
  }

  class EcombioBundleCard {
    constructor(el) {
      this.el = el;
      this.handle = el.dataset.bundleHandle || '';
      this.title = el.dataset.bundleTitle || '';

      let items = [];
      try {
        items = JSON.parse(el.dataset.bundleItems || '[]');
      } catch (err) {
        console.error(LOG_PREFIX, `Failed to parse data-bundle-items for bundle "${this.title}"`, err);
        items = [];
      }
      this.items = Array.isArray(items) ? items : [];

      this.skeletonEl = el.querySelector(SELECTORS.skeleton);
      this.contentEl = el.querySelector(SELECTORS.content);
      this.itemsListEl = el.querySelector(SELECTORS.itemsList);
      this.priceEl = el.querySelector(SELECTORS.price);
      this.comparePriceEl = el.querySelector(SELECTORS.comparePrice);
      this.savingsBadgeEl = el.querySelector(SELECTORS.savingsBadge);
      this.addBtn = el.querySelector(SELECTORS.addBtn);
      this.btnLabelEl = el.querySelector(SELECTORS.btnLabel);
      this.btnSpinnerEl = el.querySelector(SELECTORS.btnSpinner);
      this.errorEl = el.querySelector(SELECTORS.errorEl);

      this._defaultBtnLabel = this.btnLabelEl ? this.btnLabelEl.textContent : 'Add bundle to cart';
      this._hydrated = false;

      if (this.addBtn) {
        this.addBtn.addEventListener('click', (event) => {
          event.preventDefault();
          this.handleAddToCart();
        });
      }
    }

    /** Fetch live variant data for every item to refresh price/availability before rendering. */
    async hydrate() {
      if (this._hydrated) return;
      this._hydrated = true;

      if (this.items.length === 0) {
        this.showError('This bundle has no items configured.');
        console.error(LOG_PREFIX, `Bundle "${this.title}" (${this.handle}) has an empty or unparsable item list.`);
        this.revealContent();
        return;
      }

      try {
        const liveItems = await Promise.all(
          this.items.map((item) => this.fetchLiveItemData(item))
        );
        this.items = liveItems;
      } catch (err) {
        // Individual item failures are caught inside fetchLiveItemData;
        // this catch is a last-resort net in case Promise.all itself throws.
        console.error(LOG_PREFIX, `Unexpected error hydrating bundle "${this.title}"`, err);
      }

      this.render();
      this.revealContent();
    }

    /** Re-fetch a single item's product JSON to confirm current price/availability; falls back to the server-rendered snapshot on failure. */
    async fetchLiveItemData(item) {
      if (!item || !item.handle) {
        console.error(LOG_PREFIX, 'Bundle item missing product handle, using static snapshot', item);
        return item;
      }
      try {
        const res = await fetch(`/products/${item.handle}.js`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching /products/${item.handle}.js`);
        }
        const product = await res.json();
        const variant =
          product.variants.find((v) => v.id === item.variant_id) || product.variants[0];

        if (!variant) {
          throw new Error(`No variants returned for product "${item.handle}"`);
        }

        return {
          ...item,
          title: product.title,
          variant_title: variant.title,
          price: variant.price,
          compare_at_price: variant.compare_at_price,
          available: variant.available,
          image: item.image || (product.featured_image ? product.featured_image : null),
        };
      } catch (err) {
        console.error(
          LOG_PREFIX,
          `Live fetch failed for bundle item "${item.handle}" (variant ${item.variant_id}); using page-load snapshot instead.`,
          err
        );
        return item; // Degrade gracefully to the metafield-derived snapshot rendered server-side.
      }
    }

    render() {
      if (!this.itemsListEl || !this.priceEl) return;

      this.itemsListEl.innerHTML = '';
      let total = 0;
      let compareTotal = 0;
      let allAvailable = true;

      this.items.forEach((item) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const comparePrice = Number(item.compare_at_price) || price;

        total += price * qty;
        compareTotal += comparePrice * qty;
        if (!item.available) allAvailable = false;

        const li = document.createElement('li');
        if (!item.available) li.dataset.unavailable = 'true';
        const qtyLabel = qty > 1 ? ` × ${qty}` : '';
        li.innerHTML = `<span>${this.escapeHtml(item.title || 'Item')}${
          item.variant_title && item.variant_title !== 'Default Title'
            ? ` (${this.escapeHtml(item.variant_title)})`
            : ''
        }${qtyLabel}</span><span>${item.available ? formatMoney(price * qty) : 'Sold out'}</span>`;
        this.itemsListEl.appendChild(li);
      });

      this.priceEl.textContent = formatMoney(total);

      if (this.comparePriceEl) {
        if (compareTotal > total) {
          this.comparePriceEl.textContent = formatMoney(compareTotal);
          this.comparePriceEl.hidden = false;
        } else {
          this.comparePriceEl.hidden = true;
        }
      }

      if (this.savingsBadgeEl) {
        const savings = compareTotal - total;
        if (savings > 0) {
          const pct = Math.round((savings / compareTotal) * 100);
          this.savingsBadgeEl.textContent = `Save ${pct}%`;
          this.savingsBadgeEl.hidden = false;
        } else {
          this.savingsBadgeEl.hidden = true;
        }
      }

      if (!allAvailable && this.addBtn) {
        this.addBtn.disabled = true;
        this.setBtnLabel('Unavailable');
        this.showError('One or more items in this bundle are currently sold out.');
      }
    }

    revealContent() {
      if (this.skeletonEl) this.skeletonEl.hidden = true;
      if (this.contentEl) this.contentEl.hidden = false;
      this.el.classList.remove('is-loading');
    }

    escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = String(str ?? '');
      return div.innerHTML;
    }

    setBtnLabel(text) {
      if (this.btnLabelEl) this.btnLabelEl.textContent = text;
    }

    showError(message) {
      if (!this.errorEl) return;
      this.errorEl.textContent = message;
      this.errorEl.hidden = false;
      this.el.classList.add('has-error');
    }

    clearError() {
      if (!this.errorEl) return;
      this.errorEl.textContent = '';
      this.errorEl.hidden = true;
      this.el.classList.remove('has-error');
    }

    setLoadingState(isLoading) {
      this.el.classList.toggle('is-adding', isLoading);
      if (this.addBtn) this.addBtn.disabled = isLoading;
      if (this.btnSpinnerEl) this.btnSpinnerEl.hidden = !isLoading;
      if (isLoading) this.setBtnLabel('Adding…');
    }

    /**
     * Adds every item in the bundle to cart via a single, atomic
     * POST to /cart/add.js using its `items` array. Shopify processes
     * that array as one transaction: if any line is invalid (e.g. a
     * variant sold out between hydrate() and the click), the whole
     * request is rejected and nothing is added -- which avoids the
     * "half a bundle in your cart" state that sequential per-item
     * requests could leave behind on partial failure.
     */
    async handleAddToCart() {
      this.clearError();

      const availableItems = this.items.filter((item) => item.available !== false && item.variant_id);

      if (availableItems.length === 0) {
        this.showError('This bundle is unavailable right now.');
        console.error(LOG_PREFIX, `Add-to-cart blocked for bundle "${this.title}": no available items.`);
        return;
      }

      if (availableItems.length !== this.items.length) {
        this.showError('One or more items in this bundle are sold out, so the bundle can\u2019t be added right now.');
        console.error(
          LOG_PREFIX,
          `Add-to-cart blocked for bundle "${this.title}": ${this.items.length - availableItems.length} item(s) unavailable.`
        );
        return;
      }

      this.setLoadingState(true);

      let addedOk = false;
      try {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            items: availableItems.map((item) => ({
              id: item.variant_id,
              quantity: Number(item.quantity) || 1,
              properties: { _bundle: this.title || this.handle },
            })),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          const message = (data && (data.description || (data.message && data.message))) || `HTTP ${res.status}`;
          throw new Error(message);
        }

        addedOk = true;
      } catch (err) {
        console.error(LOG_PREFIX, `/cart/add.js failed for bundle "${this.title}"`, err);
        this.showError(`Couldn't add this bundle to your cart: ${err.message}`);
        document.dispatchEvent(
          new CustomEvent(CART_EVENTS.ERROR, {
            bubbles: true,
            detail: { bundle: this.title, error: err },
          })
        );
      }

      this.setLoadingState(false);

      if (addedOk) {
        this.el.classList.add('is-added');
        this.setBtnLabel('Added ✓');
        setTimeout(() => {
          this.el.classList.remove('is-added');
          this.setBtnLabel(this._defaultBtnLabel);
        }, 2500);

        await this.syncCartDrawer();
      } else {
        this.setBtnLabel(this._defaultBtnLabel);
      }
    }

    /** Refresh cart state and notify/hydrate the site's cart drawer through whichever integration point is available. */
    async syncCartDrawer() {
      let cart = null;
      try {
        const res = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching /cart.js`);
        cart = await res.json();
      } catch (err) {
        console.error(LOG_PREFIX, 'Failed to refetch /cart.js after adding bundle to cart', err);
      }

      // 1. Broadcast custom events for any listener (drawer, header count, analytics, etc).
      try {
        document.dispatchEvent(
          new CustomEvent(CART_EVENTS.ADD, { bubbles: true, detail: { cart, bundle: this.title } })
        );
        document.dispatchEvent(
          new CustomEvent(CART_EVENTS.REFRESH, { bubbles: true, detail: { cart, bundle: this.title } })
        );
        document.dispatchEvent(new CustomEvent(CART_EVENTS.OPEN, { bubbles: true, detail: { cart } }));
      } catch (err) {
        console.error(LOG_PREFIX, 'Failed dispatching cart:* events', err);
      }

      // 2. Try a direct <cart-drawer> custom element integration.
      try {
        const drawerEl = document.querySelector('cart-drawer');
        if (drawerEl) {
          if (typeof drawerEl.renderContents === 'function' && cart) {
            drawerEl.renderContents(cart);
          }
          if (typeof drawerEl.open === 'function') {
            drawerEl.open();
          } else if (typeof drawerEl.classList !== 'undefined') {
            drawerEl.classList.add('is-open', 'active');
          }
        } else {
          console.info(LOG_PREFIX, 'No <cart-drawer> element found in DOM; relying on cart:* events only.');
        }
      } catch (err) {
        console.error(LOG_PREFIX, 'Direct <cart-drawer> integration failed', err);
      }

      // 3. Fallback: refetch and swap the cart-drawer section HTML if the container exists
      //    and hasn't already been updated by step 2 (safe to run regardless; cheap no-op if absent).
      try {
        const drawerContainer = document.getElementById('CartDrawer');
        if (drawerContainer) {
          const sectionRes = await fetch(`${window.location.pathname}?section_id=cart-drawer`);
          if (sectionRes.ok) {
            const html = await sectionRes.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newContent = doc.getElementById('CartDrawer');
            if (newContent) {
              drawerContainer.innerHTML = newContent.innerHTML;
            }
          } else {
            console.error(LOG_PREFIX, `Cart drawer section refetch failed with HTTP ${sectionRes.status}`);
          }
        }
      } catch (err) {
        console.error(LOG_PREFIX, 'Fallback cart-drawer section refetch failed', err);
      }
    }
  }

  /**
   * Initializes any not-yet-initialized bundle cards found under `root`.
   * Scoping to `root` (instead of always querying the whole document)
   * means a shopify:section:load event for one section never re-scans
   * or re-binds cards belonging to other, already-initialized sections
   * on the same page. The initializedCards WeakSet is a second layer of
   * protection against double-binding even if a root is re-scanned.
   */
  function initBundleCards(root = document) {
    const cards = root.querySelectorAll
      ? root.querySelectorAll(SELECTORS.card)
      : [];
    if (!cards || cards.length === 0) return;

    const freshCards = Array.from(cards).filter((el) => !initializedCards.has(el));
    if (freshCards.length === 0) return;

    const instances = freshCards.map((el) => {
      initializedCards.add(el);
      return new EcombioBundleCard(el);
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const instance = instances.find((i) => i.el === entry.target);
            if (instance) {
              instance.hydrate().catch((err) => {
                console.error(LOG_PREFIX, 'Unhandled hydrate() rejection', err);
              });
            }
            obs.unobserve(entry.target);
          });
        },
        { rootMargin: '200px 0px' }
      );
      instances.forEach((instance) => observer.observe(instance.el));
    } else {
      // No IntersectionObserver support: hydrate everything immediately.
      instances.forEach((instance) => {
        instance.hydrate().catch((err) => {
          console.error(LOG_PREFIX, 'Unhandled hydrate() rejection', err);
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initBundleCards());
  } else {
    initBundleCards();
  }

  // Re-init after Shopify section re-renders (theme editor). Scoped to
  // event.target so unrelated sections elsewhere on the page are left
  // alone -- see initBundleCards() doc comment above.
  document.addEventListener('shopify:section:load', (event) => {
    if (event.target && event.target.querySelector && event.target.querySelector(SELECTORS.card)) {
      initBundleCards(event.target);
    }
  });
})();