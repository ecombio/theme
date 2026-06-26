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
  const mainImage      = document.getElementById('main-product-image');
  const thumbContainer = document.getElementById('vertical-thumbnails');

  // -------------------------------------------------------
  // Build a color → [mediaIds] map from productData.media.
  //
  // Strategy: for each media item, check its src filename
  // against each unique option value (e.g. "Glacier",
  // "Polar", "Himalayan"). Case-insensitive match.
  //
  // Falls back gracefully — if no match is found for a
  // color, switchMedia() is a no-op.
  // -------------------------------------------------------
  const colorMediaMap = {}; // { "Glacier": [id, id, ...], ... }

  // Collect unique color option values from variants.
  // This product uses option2 for color — we check all
  // options to be safe.
  const colorOptions = new Set();
  productData.variants.forEach(v => {
    [v.option1, v.option2, v.option3].forEach(opt => {
      if (opt) colorOptions.add(opt);
    });
  });

  // Map each media item's filename to matching color(s).
  (productData.media || []).forEach(media => {
    const src = (media.src || '').toLowerCase();
    colorOptions.forEach(color => {
      if (src.includes(color.toLowerCase())) {
        if (!colorMediaMap[color]) colorMediaMap[color] = [];
        colorMediaMap[color].push(String(media.id));
      }
    });
  });

  // -------------------------------------------------------
  // Given a variant, return the color value that has
  // mapped images. Checks all options.
  // -------------------------------------------------------
  function getVariantColor(variant) {
    const opts = [variant.option1, variant.option2, variant.option3];
    return opts.find(opt => opt && colorMediaMap[opt]) || null;
  }

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
    addToCartBtn.disabled     = !available;
    addToCartBtn.ariaDisabled = String(!available);
    addToCartBtn.textContent  = available ? 'Add to cart' : 'Sold out';
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
  // Switch gallery to the first image matching this color.
  // Activates the correct thumbnail and updates main image.
  // -------------------------------------------------------
  function switchMedia(color) {
    if (!color || !thumbContainer || !mainImage) return;

    const mediaIds = colorMediaMap[color];
    if (!mediaIds || !mediaIds.length) return;

    // Find the first thumbnail whose data-media-id is in this color's set
    const thumbs = thumbContainer.querySelectorAll('.thumbnail');
    let targetThumb = null;

    for (const thumb of thumbs) {
      if (mediaIds.includes(thumb.dataset.mediaId)) {
        targetThumb = thumb;
        break;
      }
    }

    if (!targetThumb) return;

    mainImage.src = targetThumb.dataset.fullImage;
    mainImage.alt = targetThumb.dataset.alt;

    thumbs.forEach(t => t.classList.remove('active'));
    targetThumb.classList.add('active');

    targetThumb.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
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

      pillContainer.querySelectorAll('.variant-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const variantId = parseInt(pill.dataset.variantId, 10);
      const variant   = productData.variants.find(v => v.id === variantId);
      if (!variant) return;

      if (variantIdInput) variantIdInput.value = variantId;

      updatePrice(variant);
      updateButton(variant.available);
      updateQuantity(variant);
      switchMedia(getVariantColor(variant));
      syncUrl(variantId);
    });
  }

  // -------------------------------------------------------
  // Thumbnail manual click (still works independently)
  // -------------------------------------------------------
  if (thumbContainer && mainImage) {
    thumbContainer.addEventListener('click', (e) => {
      const thumb = e.target.closest('.thumbnail');
      if (!thumb) return;

      mainImage.src = thumb.dataset.fullImage;
      mainImage.alt = thumb.dataset.alt;

      thumbContainer.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
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

    qtyInput.addEventListener('change', () => {
      const val = parseInt(qtyInput.value, 10);
      const max = qtyInput.max ? parseInt(qtyInput.max, 10) : Infinity;
      if (isNaN(val) || val < 1) qtyInput.value = 1;
      else if (val > max) qtyInput.value = max;
    });
  }

})();