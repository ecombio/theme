/**
 * product-form.js
 * Handles variant selection + AJAX add to cart + opens cart drawer
 */
(function () {
  'use strict';

  const form = document.getElementById('ProductForm');
  if (!form) return;

  const variantIdInput     = document.getElementById('ProductVariantId');
  const addToCartBtn       = document.getElementById('AddToCart');
  const quantityInput      = document.getElementById('ProductQuantity');
  const priceEl            = document.getElementById('ProductPrice');
  const comparePriceEl     = document.getElementById('ProductComparePrice');
  const stockIndicator     = document.getElementById('StockIndicator');

  // Get variants data (we'll add this in Liquid next)
  const variants = window.productVariants || [];

  if (!variants.length) {
    console.warn('[ProductForm] No variants found in window.productVariants');
  }

  // ─────────────────────────────────────────────────────────────
  // Find matching variant based on selected options
  // ─────────────────────────────────────────────────────────────
  function getSelectedVariant() {
    const selectedOptions = {};

    // Get all checked radio buttons inside the form
    form.querySelectorAll('input[type="radio"]:checked').forEach(input => {
      selectedOptions[input.name] = input.value;
    });

    return variants.find(variant => {
      return variant.options.every((optionValue, index) => {
        const optionName = variant.option1 && index === 0 ? 'Color' : 
                          variant.option2 && index === 1 ? variant.option2_name || 'Option 2' : 
                          variant.option3_name || 'Option 3';
        // Simpler approach: match by position
        return true; // We'll improve matching below
      });
    });
  }

  // Better matching function
  function findVariantByOptions() {
    const formData = new FormData(form);
    const selected = {};

    for (let [key, value] of formData.entries()) {
      if (key.startsWith('options[') || key === 'Color' || key === 'Size' || key === 'Material') {
        selected[key] = value;
      }
    }

    return variants.find(v => {
      return (
        (!selected['Color'] || v.option1 === selected['Color']) &&
        (!selected['Size'] || v.option2 === selected['Size']) &&
        (!selected['Material'] || v.option3 === selected['Material'])
      );
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Update price, stock, and hidden variant ID
  // ─────────────────────────────────────────────────────────────
  function updateVariantUI(variant) {
    if (!variant) return;

    // Update hidden variant ID
    if (variantIdInput) variantIdInput.value = variant.id;

    // Update price
    if (priceEl) {
      priceEl.textContent = formatMoney(variant.price);
      priceEl.classList.toggle('sale-price', variant.compare_at_price > variant.price);
    }

    // Update compare price
    if (comparePriceEl) {
      if (variant.compare_at_price > variant.price) {
        comparePriceEl.textContent = formatMoney(variant.compare_at_price);
        comparePriceEl.style.display = '';
      } else {
        comparePriceEl.style.display = 'none';
      }
    }

    // Update stock indicator
    if (stockIndicator) {
      const isAvailable = variant.available;
      stockIndicator.classList.toggle('available', isAvailable);
      stockIndicator.classList.toggle('sold-out', !isAvailable);

      const stockText = stockIndicator.querySelector('.stock-text');
      if (stockText) {
        if (isAvailable) {
          stockText.textContent = variant.inventory_management === 'shopify' && variant.inventory_policy === 'deny'
            ? `Available in stock (${variant.inventory_quantity})`
            : 'Available in stock';
        } else {
          stockText.textContent = 'Sold Out';
        }
      }
    }

    // Enable/disable add to cart button
    if (addToCartBtn) {
      addToCartBtn.disabled = !variant.available;
      addToCartBtn.textContent = variant.available ? 'Add To Cart' : 'Sold Out';
    }
  }

  function formatMoney(cents) {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: window.Shopify?.currency?.active || 'USD'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Listen for variant changes
  // ─────────────────────────────────────────────────────────────
  form.addEventListener('change', () => {
    const variant = findVariantByOptions();
    if (variant) {
      updateVariantUI(variant);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // AJAX Add to Cart
  // ─────────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const variantId = parseInt(variantIdInput?.value, 10);
    const quantity = parseInt(quantityInput?.value, 10) || 1;

    if (!variantId) {
      alert('Please select a variant');
      return;
    }

    addToCartBtn.disabled = true;
    addToCartBtn.textContent = 'Adding...';

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: variantId,
          quantity: quantity
        })
      });

      if (!res.ok) throw new Error('Add to cart failed');

      // Success - open the cart drawer
      document.dispatchEvent(new CustomEvent('cart:open'));

      // Optional: show a quick success state
      addToCartBtn.textContent = 'Added!';
      setTimeout(() => {
        if (addToCartBtn) {
          addToCartBtn.textContent = 'Add To Cart';
          addToCartBtn.disabled = false;
        }
      }, 1200);

    } catch (err) {
      console.error('[ProductForm] Add to cart error:', err);
      addToCartBtn.textContent = 'Error - Try Again';
      setTimeout(() => {
        if (addToCartBtn) {
          addToCartBtn.textContent = 'Add To Cart';
          addToCartBtn.disabled = false;
        }
      }, 2000);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Initial setup
  // ─────────────────────────────────────────────────────────────
  function init() {
    // Set initial variant from current selection
    const initialVariant = findVariantByOptions() || variants[0];
    if (initialVariant) {
      updateVariantUI(initialVariant);
    }

    // Make sure quantity buttons work (if you have +/- buttons)
    const minusBtn = form.querySelector('button[name="minus"]');
    const plusBtn = form.querySelector('button[name="plus"]');

    if (minusBtn && quantityInput) {
      minusBtn.addEventListener('click', () => {
        let val = parseInt(quantityInput.value, 10) || 1;
        quantityInput.value = Math.max(1, val - 1);
      });
    }

    if (plusBtn && quantityInput) {
      plusBtn.addEventListener('click', () => {
        let val = parseInt(quantityInput.value, 10) || 1;
        quantityInput.value = val + 1;
      });
    }
  }

  init();
})();