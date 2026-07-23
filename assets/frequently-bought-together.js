/**
 * frequently-bought-together.js
 *
 * Drives sections/frequently-bought-together.liquid.
 *
 * Core logic:
 * 1. On load, reveal the section (shimmer placeholders become visible)
 *    and re-request the section via the Product Recommendations
 *    endpoint with intent=complementary. Shopify resolves the
 *    `recommendations` object server-side and returns the section's
 *    rendered HTML — pricing, "+" separators, and sold-out states are
 *    all still produced by Liquid, not duplicated here.
 * 2. Swap the returned #fbt-products-{id} markup into the DOM. If the
 *    fetch comes back with no complementary recommendations (no
 *    Search & Discovery coverage for this product), re-hide the
 *    section — same fallback behavior as product-complementary.liquid.
 * 3. Wire up checkboxes, variant selects, running total, and the
 *    "Add all to cart" button on the newly rendered nodes.
 */
(() => {
  class FrequentlyBoughtTogether {
    constructor(section) {
      this.section = section;
      this.productsWrap = section.querySelector('[data-fbt-products]');
      this.totalEl = section.querySelector('[data-fbt-total]');
      this.addButton = section.querySelector('[data-fbt-add-button]');
      this.buttonText = section.querySelector('[data-fbt-button-text]');
      this.messageEl = section.querySelector('[data-fbt-message]');
      this.moneyFormat = section.dataset.moneyFormat || '${{amount}}';

      this.init();
    }

    init() {
      // Reveal the shimmer state immediately, then fetch the real
      // complementary recommendations to replace it.
      this.section.hidden = false;
      this.fetchRecommendations();
    }

    fetchRecommendations() {
      const { recommendationsUrl, sectionId, productId, limit, intent } = this.section.dataset;
      const url = `${recommendationsUrl}?section_id=${sectionId}&product_id=${productId}&limit=${limit}&intent=${intent}`;

      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Recommendations request failed (${response.status})`);
          return response.text();
        })
        .then((html) => this.render(html))
        .catch((error) => {
          console.error('Frequently bought together:', error);
          // No usable data — fall back to hiding the module rather than
          // showing a broken/empty state.
          this.section.hidden = true;
        });
    }

    render(html) {
      const doc = document.createElement('div');
      doc.innerHTML = html;

      const newSection = doc.querySelector('[data-fbt-section]');
      const newProducts = doc.querySelector('[data-fbt-products]');

      if (!newSection || newSection.dataset.performed !== 'true' || !newProducts) {
        // Search & Discovery has no complementary pairing for this
        // product (yet) — stay hidden, same as the SSR fallback.
        this.section.hidden = true;
        return;
      }

      this.productsWrap.innerHTML = newProducts.innerHTML;
      this.section.hidden = false;

      this.bindItemEvents();
      this.recalculate();
    }

    bindItemEvents() {
      this.productsWrap.querySelectorAll('[data-fbt-checkbox]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => this.recalculate());
      });

      this.productsWrap.querySelectorAll('[data-fbt-variant-select]').forEach((select) => {
        select.addEventListener('change', (event) => this.handleVariantChange(event));
      });

      if (this.addButton) {
        this.addButton.addEventListener('click', () => this.addAllToCart());
      }
    }

    handleVariantChange(event) {
      const select = event.currentTarget;
      const item = select.closest('[data-fbt-item]');
      const option = select.options[select.selectedIndex];
      if (!item || !option) return;

      const price = option.dataset.price || 0;
      const variantId = option.value;

      item.dataset.price = price;
      item.dataset.variantId = variantId;

      const priceEl = item.querySelector('[data-fbt-price]');
      if (priceEl) {
        priceEl.innerHTML = this.formatMoneySpans(price);
      }

      this.recalculate();
    }

    getIncludedItems() {
      return Array.from(this.productsWrap.querySelectorAll('[data-fbt-item]')).filter((item) => {
        if (item.dataset.fbtDisabled === 'true') return false;
        const checkbox = item.querySelector('[data-fbt-checkbox]');
        // The main item has no toggle checkbox — it's always included.
        return checkbox ? checkbox.checked : true;
      });
    }

    recalculate() {
      const items = this.getIncludedItems();
      const total = items.reduce((sum, item) => sum + Number(item.dataset.price || 0), 0);

      if (this.totalEl) {
        this.totalEl.textContent = this.formatMoney(total);
      }

      if (this.buttonText) {
        const template = this.addButton?.dataset.labelTemplate || 'Add all [count] to Cart';
        this.buttonText.textContent = template.replace('[count]', items.length);
      }

      if (this.addButton) {
        this.addButton.disabled = items.length === 0;
      }
    }

    addAllToCart() {
      const items = this.getIncludedItems()
        .map((item) => ({ id: Number(item.dataset.variantId), quantity: 1 }))
        .filter((line) => Number.isFinite(line.id) && line.id > 0);

      if (!items.length) return;

      const root = window.Shopify?.routes?.root || '/';

      this.addButton.classList.add('is-loading');
      this.addButton.disabled = true;
      this.setMessage('');

      fetch(`${root}cart/add.js`.replace(/\/{2,}/g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items }),
      })
        .then((response) => {
          if (!response.ok) return response.json().then((err) => Promise.reject(err));
          return response.json();
        })
        .then(() => {
          this.setMessage('Added to your cart.');
          // Let a cart drawer / header cart count elsewhere on the page
          // know it should refresh. Hook this up to your theme's
          // existing cart-update event if it uses a different name.
          document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
        })
        .catch((error) => {
          this.setMessage(error?.description || error?.message || 'Something went wrong adding these to your cart.', true);
        })
        .finally(() => {
          this.addButton.classList.remove('is-loading');
          this.addButton.disabled = false;
        });
    }

    setMessage(text, isError = false) {
      if (!this.messageEl) return;
      this.messageEl.textContent = text;
      this.messageEl.classList.toggle('fbt-message--error', Boolean(isError));
    }

    // Splits a formatted money string into symbol/whole/decimal spans,
    // matching the markup the Liquid template renders server-side.
    formatMoneySpans(cents) {
      const formatted = this.formatMoney(cents);
      const decimalStart = formatted.length - 3;
      const symbol = formatted.slice(0, 1);
      const whole = formatted.slice(1, decimalStart);
      const decimal = formatted.slice(decimalStart);

      return `<span class="fbt-item-price__symbol">${symbol}</span><span class="fbt-item-price__whole">${whole}</span><span class="fbt-item-price__decimal">${decimal}</span>`;
    }

    // Formats cents using the shop's money_format string (passed down
    // via data-money-format), so this doesn't need to guess at currency
    // symbol or decimal conventions. Prefers window.Shopify.formatMoney
    // if the theme already loads it.
    formatMoney(cents) {
      cents = Number(cents) || 0;

      if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
        return window.Shopify.formatMoney(cents, this.moneyFormat);
      }

      const noDecimals = /amount_no_decimals/.test(this.moneyFormat);
      const value = noDecimals
        ? Math.round(cents / 100).toString()
        : (cents / 100).toFixed(2);

      const formatted = value.replace(/\B(?=(\d{3})+(?=\.|$))/g, ',');

      return this.moneyFormat.replace(/\{\{\s*\w+\s*\}\}/, formatted) || `$${value}`;
    }
  }

  document.querySelectorAll('[data-fbt-section]').forEach((section) => {
    new FrequentlyBoughtTogether(section);
  });
})();