/**
 * sections/main-product.js
 *
 * Behavior only. This file toggles classes and attributes and lets
 * main-product.css (via existing tokens) own every visual outcome.
 * It never sets inline styles or colors — that would bypass the
 * token system and break when a preset or setting changes.
 */
class ProductForm extends HTMLElement {
  connectedCallback() {
    this.variants = JSON.parse(
      this.querySelector('[data-product-json]').textContent
    );

    this.form = this.querySelector('[data-product-form]');
    this.variantIdInput = this.querySelector('[data-product-variant-id]');
    this.priceEl = this.querySelector('[data-product-price]');
    this.comparePriceEl = this.querySelector('[data-product-compare-price]');
    this.saveBadgeEl = this.querySelector('[data-product-save-badge]');
    this.atcButton = this.querySelector('[data-product-atc]');
    this.atcLabel = this.querySelector('[data-atc-label]');
    this.quantityInput = this.querySelector('[data-quantity-input]');

    this.selectedOptions = this.getInitialSelectedOptions();

    this.querySelectorAll('[data-option-index]').forEach((group) => {
      group.addEventListener('click', (event) => {
        const pill = event.target.closest('[data-option-value]');
        if (!pill || pill.classList.contains('is-unavailable')) return;
        this.selectOption(group, pill);
      });
    });

    this.querySelector('[data-quantity-decrease]')
      ?.addEventListener('click', () => this.stepQuantity(-1));
    this.querySelector('[data-quantity-increase]')
      ?.addEventListener('click', () => this.stepQuantity(1));

    this.form?.addEventListener('submit', (event) => this.handleAddToCart(event));
  }

  getInitialSelectedOptions() {
    return Array.from(this.querySelectorAll('[data-option-index]')).map((group) => {
      const active = group.querySelector('.is-active');
      return active ? active.dataset.optionValue : null;
    });
  }

  selectOption(group, pill) {
    const index = Number(group.dataset.optionIndex);
    this.selectedOptions[index] = pill.dataset.optionValue;

    group.querySelectorAll('[data-option-value]').forEach((el) => {
      el.classList.toggle('is-active', el === pill);
    });

    const matchedVariant = this.variants.find((variant) =>
      variant.options.every((opt, i) => opt === this.selectedOptions[i])
    );

    this.updateAvailability(matchedVariant);

    if (matchedVariant) {
      this.applyVariant(matchedVariant);
    }
  }

  updateAvailability(matchedVariant) {
    // Mark pills unavailable if no in-stock variant exists for that
    // combination. Availability is communicated with a class only —
    // color/opacity for .is-unavailable lives in main-product.css.
    this.querySelectorAll('[data-option-index]').forEach((group) => {
      const index = Number(group.dataset.optionIndex);
      group.querySelectorAll('[data-option-value]').forEach((pill) => {
        const hypothetical = [...this.selectedOptions];
        hypothetical[index] = pill.dataset.optionValue;
        const exists = this.variants.some(
          (variant) =>
            variant.available &&
            variant.options.every((opt, i) => opt === hypothetical[i])
        );
        pill.classList.toggle('is-unavailable', !exists);
      });
    });

    const atcAvailable = Boolean(matchedVariant && matchedVariant.available);
    this.atcButton.disabled = !atcAvailable;
    this.atcButton.classList.toggle('is-sold-out', !atcAvailable);
    this.atcLabel.textContent = matchedVariant
      ? (atcAvailable ? 'Add to cart' : 'Sold out')
      : 'Unavailable';
  }

  applyVariant(variant) {
    this.variantIdInput.value = variant.id;
    this.priceEl.textContent = this.formatMoney(variant.price);
    this.priceEl.classList.toggle(
      'product__price--sale',
      variant.compare_at_price > variant.price
    );

    const onSale = variant.compare_at_price > variant.price;
    if (this.comparePriceEl) {
      this.comparePriceEl.hidden = !onSale;
      this.comparePriceEl.textContent = onSale
        ? this.formatMoney(variant.compare_at_price)
        : '';
    }
    if (this.saveBadgeEl) {
      this.saveBadgeEl.hidden = !onSale;
      this.saveBadgeEl.textContent = onSale
        ? `Save ${this.formatMoney(variant.compare_at_price - variant.price)}`
        : '';
    }
  }

  formatMoney(cents) {
    return (cents / 100).toLocaleString(undefined, {
      style: 'currency',
      currency: window.Shopify?.currency?.active || 'USD',
    });
  }

  stepQuantity(delta) {
    const current = parseInt(this.quantityInput.value, 10) || 1;
    this.quantityInput.value = Math.max(1, current + delta);
  }

  async handleAddToCart(event) {
    event.preventDefault();
    if (this.atcButton.disabled) return;

    const formData = new FormData(this.form);
    this.atcButton.disabled = true;

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Add to cart failed');

      this.atcButton.classList.add('is-added');
      this.atcLabel.textContent = 'Added';

      document.dispatchEvent(new CustomEvent('cart:updated'));

      setTimeout(() => {
        this.atcButton.classList.remove('is-added');
        this.atcLabel.textContent = 'Add to cart';
        this.atcButton.disabled = false;
      }, 1800);
    } catch (error) {
      this.atcLabel.textContent = 'Error — try again';
      this.atcButton.disabled = false;
    }
  }
}

customElements.define('product-form', ProductForm);
