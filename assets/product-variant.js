(() => {
  const productData = window.productData;
  if (!productData) return;

  // -------------------------------------------------------
  // Elements
  // -------------------------------------------------------
  const pillContainer  = document.getElementById('variant-pills');
  const variantIdInput = document.getElementById('variant-id');
  const addToCartBtn   = document.getElementById('add-to-cart');
  const priceContainer = document.getElementById('product-price');
  const qtyInput       = document.getElementById('quantity');
  const qtyDec         = document.getElementById('qty-dec');
  const qtyInc         = document.getElementById('qty-inc');

  // -------------------------------------------------------
  // Format Shopify price integer (cents) → currency string
  // -------------------------------------------------------
  function formatMoney(cents) {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }

  // -------------------------------------------------------
  // Update price block in product-info
  // -------------------------------------------------------
  function updatePrice(variant) {
    if (!priceContainer) return;

    const price          = parseInt(variant.price, 10);
    const compareAtPrice = parseInt(variant.compare_at_price, 10);
    const onSale         = compareAtPrice > 0 && compareAtPrice > price;

    if (onSale) {
      priceContainer.innerHTML = `
        <span class="price-compare">${formatMoney(compareAtPrice)}</span>
        <span class="price-sale">${formatMoney(price)}</span>
        <span class="price-badge">Sale</span>
      `;
    } else {
      priceContainer.innerHTML = `
        <span class="price-regular">${formatMoney(price)}</span>
      `;
    }
  }

  // -------------------------------------------------------
  // Update add-to-cart button
  // -------------------------------------------------------
  function updateButton(available) {
    if (!addToCartBtn) return;
    addToCartBtn.disabled      = !available;
    addToCartBtn.ariaDisabled  = String(!available);
    addToCartBtn.textContent   = available ? 'Add to cart' : 'Sold out';
  }

  // -------------------------------------------------------
  // Update quantity stepper max
  // -------------------------------------------------------
  function updateQuantity(variant) {
    if (!qtyInput) return;

    if (variant.inventory_management === 'shopify') {
      const max = variant.inventory_quantity;
      qtyInput.max = max;
      if (parseInt(qtyInput.value, 10) > max) qtyInput.value = Math.max(1, max);
    } else {
      qtyInput.removeAttribute('max');
    }
  }

  // -------------------------------------------------------
  // Sync URL ?variant= param (no reload)
  // -------------------------------------------------------
  function syncUrl(variantId) {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', variantId);
    window.history.replaceState({}, '', url);
  }

  // -------------------------------------------------------
  // Variant pill selection
  // -------------------------------------------------------
  if (pillContainer) {
    pillContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.variant-pill');
      if (!pill || pill.classList.contains('sold-out')) return;

      // Update active pill
      pillContainer.querySelectorAll('.variant-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const variantId = parseInt(pill.dataset.variantId, 10);
      const variant   = productData.variants.find(v => v.id === variantId);
      if (!variant) return;

      // Sync hidden form input
      if (variantIdInput) variantIdInput.value = variantId;

      updatePrice(variant);
      updateButton(variant.available);
      updateQuantity(variant);
      syncUrl(variantId);
    });
  }

  // -------------------------------------------------------
  // Quantity stepper
  // -------------------------------------------------------
  if (qtyDec && qtyInc && qtyInput) {
    qtyDec.addEventListener('click', () => {
      const val = parseInt(qtyInput.value, 10);
      if (val > 1) qtyInput.value = val - 1;
    });

    qtyInc.addEventListener('click', () => {
      const val = parseInt(qtyInput.value, 10);
      const max = qtyInput.max ? parseInt(qtyInput.max, 10) : Infinity;
      if (val < max) qtyInput.value = val + 1;
    });

    // Clamp manual keyboard input
    qtyInput.addEventListener('change', () => {
      const val = parseInt(qtyInput.value, 10);
      const max = qtyInput.max ? parseInt(qtyInput.max, 10) : Infinity;
      if (isNaN(val) || val < 1) qtyInput.value = 1;
      else if (val > max) qtyInput.value = max;
    });
  }

})();