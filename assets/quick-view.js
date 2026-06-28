/**
 * Quick View Modal
 * ================
 * Fetches product JSON and renders a modal with images,
 * variant selector, description, and add-to-cart.
 *
 * Dependencies: none (vanilla JS, ES2017+)
 *
 * Integration with product-card.liquid:
 *   Add to each card's image wrapper:
 *     <button
 *       class="product-card__quick-view js-quick-view-trigger"
 *       data-product-url="{{ product.url }}"
 *       aria-label="Quick view {{ product.title }}"
 *     >Quick View</button>
 */

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────

  const state = {
    product: null,
    selectedOptions: [],
    selectedVariant: null,
  };

  // ─── DOM refs ─────────────────────────────────────────────────────────────

  const modal       = document.getElementById('quick-view-modal');
  const contentEl   = document.getElementById('quick-view-content');
  const template    = document.getElementById('quick-view-template');

  if (!modal || !contentEl || !template) return; // section not on page

  // ─── Open / Close ─────────────────────────────────────────────────────────

  function openModal() {
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    trapFocus(modal);
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    releaseFocus();
    // Clear content after transition
    setTimeout(() => { contentEl.innerHTML = ''; }, 300);
  }

  // Close triggers
  modal.addEventListener('click', (e) => {
    if (e.target.closest('.js-quick-view-close')) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  // ─── Fetch & Render ───────────────────────────────────────────────────────

  async function loadProduct(productUrl) {
    contentEl.innerHTML = ''; // triggers spinner via CSS :empty
    openModal();

    try {
      const res = await fetch(`${productUrl}.js`);
      if (!res.ok) throw new Error('Product not found');
      const product = await res.json();
      state.product = product;
      state.selectedOptions = product.variants[0].options.slice(); // clone first variant options
      state.selectedVariant = product.variants[0];
      renderProduct(product);
    } catch (err) {
      contentEl.innerHTML = `<p style="padding:2rem;text-align:center;">Sorry, couldn't load this product.</p>`;
      console.error('[QuickView]', err);
    }
  }

  function renderProduct(product) {
    const clone = template.content.cloneNode(true);
    contentEl.innerHTML = '';
    contentEl.appendChild(clone);

    // Vendor
    const vendorEl = document.getElementById('quick-view-vendor');
    if (vendorEl) {
      vendorEl.textContent = product.vendor;
      if (!product.vendor) vendorEl.style.display = 'none';
    }

    // Title
    const titleEl = document.getElementById('quick-view-title');
    if (titleEl) titleEl.textContent = product.title;

    // Full-details link
    const linkEl = document.getElementById('quick-view-full-link');
    if (linkEl) linkEl.href = product.url;

    // Description
    const descEl = document.getElementById('quick-view-description');
    if (descEl) descEl.innerHTML = product.description;

    // Gallery
    renderGallery(product);

    // Variants
    renderVariants(product);

    // Price
    updatePrice();

    // ATC button
    const atcBtn = document.getElementById('quick-view-atc-btn');
    if (atcBtn) {
      updateAtcButton(atcBtn);
      atcBtn.addEventListener('click', () => addToCart(atcBtn));
    }

    // Quantity controls
    setupQuantityControls();
  }

  // ─── Gallery ──────────────────────────────────────────────────────────────

  function renderGallery(product) {
    const mainImg    = document.getElementById('quick-view-main-image');
    const thumbsEl   = document.getElementById('quick-view-thumbnails');

    if (!mainImg || !thumbsEl || !product.images.length) return;

    function setMainImage(src, alt) {
      mainImg.style.opacity = '0';
      mainImg.src = src;
      mainImg.alt = alt || product.title;
      mainImg.onload = () => { mainImg.style.opacity = '1'; };
    }

    setMainImage(product.featured_image, product.title);
    thumbsEl.innerHTML = '';

    product.images.forEach((imgUrl, i) => {
      const btn = document.createElement('button');
      btn.className = 'quick-view-product__thumb' + (i === 0 ? ' is-active' : '');
      btn.setAttribute('aria-label', `View image ${i + 1}`);
      btn.type = 'button';

      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 56;
      img.height = 56;

      btn.appendChild(img);
      btn.addEventListener('click', () => {
        thumbsEl.querySelectorAll('.quick-view-product__thumb').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        setMainImage(imgUrl, product.title);
      });

      thumbsEl.appendChild(btn);
    });
  }

  // ─── Variant Selector ─────────────────────────────────────────────────────

  function renderVariants(product) {
    const variantsEl = document.getElementById('quick-view-variants');
    if (!variantsEl) return;
    variantsEl.innerHTML = '';

    if (product.options.length === 1 && product.options[0] === 'Title') return;

    product.options.forEach((optionName, optionIndex) => {
      const values = [...new Set(product.variants.map(v => v.options[optionIndex]))];

      const group = document.createElement('div');
      group.className = 'quick-view-variant-group';

      const labelEl = document.createElement('p');
      labelEl.className = 'quick-view-variant-group__label';
      labelEl.innerHTML = `${optionName}: <span>${state.selectedOptions[optionIndex] || values[0]}</span>`;
      group.appendChild(labelEl);

      const optionsEl = document.createElement('div');
      optionsEl.className = 'quick-view-variant-group__options';

      values.forEach((value) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quick-view-variant-btn';
        btn.textContent = value;
        btn.dataset.optionIndex = optionIndex;
        btn.dataset.optionValue = value;

        if (value === state.selectedOptions[optionIndex]) {
          btn.classList.add('is-selected');
        }

        // Check availability for this value
        const available = product.variants.some(
          v => v.options[optionIndex] === value && v.available
        );
        if (!available) btn.classList.add('is-unavailable');

        btn.addEventListener('click', () => {
          state.selectedOptions[optionIndex] = value;
          // Update label
          labelEl.innerHTML = `${optionName}: <span>${value}</span>`;
          // Update selected state
          optionsEl.querySelectorAll('.quick-view-variant-btn').forEach(b => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          // Find matching variant
          state.selectedVariant = findVariant(product);
          updatePrice();
          updateGalleryForVariant();
          const atcBtn = document.getElementById('quick-view-atc-btn');
          if (atcBtn) updateAtcButton(atcBtn);
        });

        optionsEl.appendChild(btn);
      });

      group.appendChild(optionsEl);
      variantsEl.appendChild(group);
    });
  }

  function findVariant(product) {
    return product.variants.find(v =>
      v.options.every((opt, i) => opt === state.selectedOptions[i])
    ) || null;
  }

  function updateGalleryForVariant() {
    const v = state.selectedVariant;
    if (!v || !v.featured_image) return;
    const mainImg = document.getElementById('quick-view-main-image');
    if (!mainImg) return;
    mainImg.style.opacity = '0';
    mainImg.src = v.featured_image.src;
    mainImg.onload = () => { mainImg.style.opacity = '1'; };

    // Update active thumb
    const thumbsEl = document.getElementById('quick-view-thumbnails');
    if (!thumbsEl) return;
    const thumbs = thumbsEl.querySelectorAll('.quick-view-product__thumb img');
    thumbs.forEach((img, i) => {
      const thumb = img.parentElement;
      if (img.src === v.featured_image.src) {
        thumbsEl.querySelectorAll('.quick-view-product__thumb').forEach(b => b.classList.remove('is-active'));
        thumb.classList.add('is-active');
      }
    });
  }

  // ─── Price ────────────────────────────────────────────────────────────────

  function updatePrice() {
    const priceEl = document.getElementById('quick-view-price');
    if (!priceEl) return;

    const v = state.selectedVariant || state.product?.variants[0];
    if (!v) return;

    const format = (cents) => {
      const amount = (cents / 100).toFixed(2);
      return `${window.Shopify?.currency?.active || '$'}${amount}`;
    };

    if (v.compare_at_price && v.compare_at_price > v.price) {
      priceEl.innerHTML = `<s>${format(v.compare_at_price)}</s> <span class="price--sale">${format(v.price)}</span>`;
    } else {
      priceEl.textContent = format(v.price);
    }
  }

  // ─── ATC Button ───────────────────────────────────────────────────────────

  function updateAtcButton(btn) {
    const v = state.selectedVariant;
    if (!v) {
      btn.textContent = 'Unavailable';
      btn.disabled = true;
      return;
    }
    btn.dataset.variantId = v.id;
    btn.disabled = !v.available;
    btn.textContent = v.available ? 'Add to cart' : 'Sold out';
  }

  async function addToCart(btn) {
    const variantId = parseInt(btn.dataset.variantId, 10);
    const qty = parseInt(document.getElementById('quick-view-qty')?.value || '1', 10);
    if (!variantId) return;

    btn.classList.add('is-loading');
    btn.textContent = 'Adding…';

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: qty }),
      });

      if (!res.ok) throw new Error('Add to cart failed');

      btn.classList.remove('is-loading');
      btn.classList.add('is-added');
      btn.textContent = 'Added!';

      // Dispatch cart update event for theme cart drawer/counter
      document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));

      setTimeout(() => {
        btn.classList.remove('is-added');
        updateAtcButton(btn);
      }, 2000);

    } catch (err) {
      btn.classList.remove('is-loading');
      btn.textContent = 'Error – try again';
      console.error('[QuickView] Add to cart error:', err);
      setTimeout(() => updateAtcButton(btn), 2000);
    }
  }

  // ─── Quantity Controls ────────────────────────────────────────────────────

  function setupQuantityControls() {
    const qtyInput = document.getElementById('quick-view-qty');
    const minusBtn = contentEl.querySelector('.js-qty-minus');
    const plusBtn  = contentEl.querySelector('.js-qty-plus');

    if (!qtyInput || !minusBtn || !plusBtn) return;

    minusBtn.addEventListener('click', () => {
      const v = parseInt(qtyInput.value, 10);
      if (v > 1) qtyInput.value = v - 1;
    });

    plusBtn.addEventListener('click', () => {
      qtyInput.value = parseInt(qtyInput.value, 10) + 1;
    });
  }

  // ─── Focus Trap ───────────────────────────────────────────────────────────

  let previousFocus = null;

  function trapFocus(el) {
    previousFocus = document.activeElement;
    const focusable = el.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first.focus();

    el._focusTrapHandler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    el.addEventListener('keydown', el._focusTrapHandler);
  }

  function releaseFocus() {
    if (modal._focusTrapHandler) {
      modal.removeEventListener('keydown', modal._focusTrapHandler);
    }
    if (previousFocus) previousFocus.focus();
  }

  // ─── Listen for quickview:open fired by product-card.js ──────────────────
  // product-card.js fires: emit('quickview:open', { handle, trigger: btn })
  // We build the product URL from the handle and fetch its .js endpoint.

  document.addEventListener('quickview:open', (e) => {
    const { handle } = e.detail || {};
    if (!handle) return;
    loadProduct(`/products/${handle}`);
  });

})();