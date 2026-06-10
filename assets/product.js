/**
 * Product Page JS
 * Real variant handling + AJAX Add to Cart + Cart Drawer
 */
(function () {
  'use strict';

  /* ─── Variant Selection + Add to Cart ─────────────────── */

  function initProductForm() {
    const form = document.getElementById('ProductForm');
    if (!form) return;

    const variantIdInput   = document.getElementById('ProductVariantId');
    const addToCartBtn     = document.getElementById('AddToCart');
    const quantityInput    = document.getElementById('ProductQuantity');
    const priceEl          = document.getElementById('ProductPrice');
    const comparePriceEl   = document.getElementById('ProductComparePrice');
    const stockIndicator   = document.getElementById('StockIndicator');

    const variants = window.productVariants || [];

    if (!variants.length) {
      console.error('[Product] window.productVariants is missing!');
      return;
    }

    // Find matching variant from selected options
    function getCurrentVariant() {
      const selected = {};
      form.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
        selected[radio.name] = radio.value;
      });

      return variants.find(v => {
        const match1 = !selected.Color     || v.option1 === selected.Color;
        const match2 = !selected.Size      || v.option2 === selected.Size;
        const match3 = !selected.Material  || v.option3 === selected.Material;
        return match1 && match2 && match3;
      });
    }

    function updateUI(variant) {
      if (!variant) return;

      if (variantIdInput) variantIdInput.value = variant.id;

      if (priceEl) {
        priceEl.textContent = formatMoney(variant.price);
        priceEl.classList.toggle('sale-price', variant.compare_at_price > variant.price);
      }

      if (comparePriceEl) {
        if (variant.compare_at_price > variant.price) {
          comparePriceEl.textContent = formatMoney(variant.compare_at_price);
          comparePriceEl.style.display = '';
        } else {
          comparePriceEl.style.display = 'none';
        }
      }

      if (stockIndicator) {
        const available = variant.available;
        stockIndicator.classList.toggle('available', available);
        stockIndicator.classList.toggle('sold-out', !available);

        const text = stockIndicator.querySelector('.stock-text');
        if (text) {
          text.textContent = available 
            ? (variant.inventory_quantity ? `Available in stock (${variant.inventory_quantity})` : 'Available in stock')
            : 'Sold Out';
        }
      }

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

    // When user changes any option
    form.addEventListener('change', () => {
      const variant = getCurrentVariant();
      if (variant) updateUI(variant);
    });

    // Real AJAX Add to Cart
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const variantId = parseInt(variantIdInput?.value);
      const qty = parseInt(quantityInput?.value) || 1;

      if (!variantId) return alert('Please select all options');

      addToCartBtn.disabled = true;
      addToCartBtn.textContent = 'Adding...';

      try {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: variantId, quantity: qty })
        });

        if (!res.ok) throw new Error();

        // Open your cart drawer
        document.dispatchEvent(new CustomEvent('cart:open'));

        addToCartBtn.textContent = 'Added!';
        setTimeout(() => {
          addToCartBtn.textContent = 'Add To Cart';
          addToCartBtn.disabled = false;
        }, 1200);

      } catch (err) {
        addToCartBtn.textContent = 'Error';
        setTimeout(() => {
          addToCartBtn.textContent = 'Add To Cart';
          addToCartBtn.disabled = false;
        }, 1500);
      }
    });

    // Quantity +/- buttons
    const minusBtn = form.querySelector('button[name="minus"]');
    const plusBtn = form.querySelector('button[name="plus"]');

    if (minusBtn) minusBtn.addEventListener('click', () => {
      quantityInput.value = Math.max(1, (parseInt(quantityInput.value) || 1) - 1);
    });

    if (plusBtn) plusBtn.addEventListener('click', () => {
      quantityInput.value = (parseInt(quantityInput.value) || 1) + 1;
    });

    // Initial load
    const initial = getCurrentVariant() || variants[0];
    if (initial) updateUI(initial);
  }

  /* ─── Gallery (you can delete this block later) ───────── */

  function initGallery() {
    // Your existing gallery code can stay here if you still want it
    // For now I'm leaving it out so it doesn't conflict
  }

  /* ─── Boot ─────────────────────────────────────────────── */

  function init() {
    initProductForm();
    initGallery();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();