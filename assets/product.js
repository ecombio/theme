/**
 * Product Page — Static Demo
 * Handles gallery, variant selection, quantity, and cart/buy feedback.
 */

(function () {
  'use strict';

  /* ─── Gallery ─────────────────────────────────────────── */

  const GALLERY_IMAGES = [
    {
      src: 'https://placehold.co/787x787/f5f0ea/8c7355?text=Task+Chair+Luxe',
      alt: 'Task Chair Luxe – front view',
    },
    {
      src: 'https://placehold.co/787x787/ede6db/8c7355?text=Side+View',
      alt: 'Task Chair Luxe – side view',
    },
    {
      src: 'https://placehold.co/787x787/e3dbd0/8c7355?text=Lifestyle',
      alt: 'Task Chair Luxe – lifestyle setting',
    },
  ];

  function initGallery() {
    const thumbnails = document.querySelectorAll('.thumbnail-item');
    const mainImage = document.getElementById('FeaturedImage');

    if (!thumbnails.length || !mainImage) return;

    function selectThumbnail(index) {
      thumbnails.forEach((t, i) => {
        const active = i === index;
        t.classList.toggle('active', active);
        t.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      const img = GALLERY_IMAGES[index];
      if (img) {
        mainImage.src = img.src;
        mainImage.alt = img.alt;
      }
    }

    thumbnails.forEach((thumb, i) => {
      thumb.addEventListener('click', () => selectThumbnail(i));
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectThumbnail(i);
        }
      });
    });
  }

  /* ─── Variant Selection ────────────────────────────────── */

  function initVariantSelection() {
    // Color swatches
    const colorInputs = document.querySelectorAll('input[name="Color"]');
    const colorLabel = document.getElementById('SelectedColor');

    colorInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (colorLabel) colorLabel.textContent = input.value;
      });
    });

    // Material buttons
    const materialInputs = document.querySelectorAll('input[name="Material"]');
    const materialLabel = document.getElementById('SelectedMaterial');

    materialInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (materialLabel) materialLabel.textContent = input.value;
      });
    });
  }

  /* ─── Quantity Selector ────────────────────────────────── */

  function initQuantitySelector() {
    const input = document.getElementById('ProductQuantity');
    const minus = document.querySelector('.quantity-button[name="minus"]');
    const plus = document.querySelector('.quantity-button[name="plus"]');

    if (!input) return;

    function clamp(val) {
      return Math.max(1, Math.min(99, val));
    }

    if (minus) {
      minus.addEventListener('click', () => {
        input.value = clamp((parseInt(input.value, 10) || 1) - 1);
      });
    }

    if (plus) {
      plus.addEventListener('click', () => {
        input.value = clamp((parseInt(input.value, 10) || 1) + 1);
      });
    }

    input.addEventListener('change', () => {
      input.value = clamp(parseInt(input.value, 10) || 1);
    });

    input.addEventListener('blur', () => {
      input.value = clamp(parseInt(input.value, 10) || 1);
    });
  }

  /* ─── Buy Buttons ──────────────────────────────────────── */

  function initBuyButtons() {
    const addToCart = document.getElementById('AddToCart');
    const buyNow = document.getElementById('BuyNow');

    if (addToCart) {
      addToCart.addEventListener('click', () => {
        if (addToCart.disabled) return;
        setButtonState(addToCart, 'Added to Cart ✓', true, 'success');
        setTimeout(() => resetButtonState(addToCart, 'Add To Cart'), 2500);
      });
    }

    if (buyNow) {
      buyNow.addEventListener('click', () => {
        setButtonState(buyNow, 'Redirecting…', true, null);
        // In a real implementation: window.location.href = '/checkout';
        setTimeout(() => resetButtonState(buyNow, 'Buy It Now'), 2000);
      });
    }
  }

  function setButtonState(btn, text, disabled, cssClass) {
    btn.textContent = text;
    btn.disabled = disabled;
    if (cssClass) btn.classList.add(cssClass);
  }

  function resetButtonState(btn, text) {
    btn.textContent = text;
    btn.disabled = false;
    btn.classList.remove('success');
  }

  /* ─── Accordions ───────────────────────────────────────── */

  function initAccordions() {
    // Nothing extra needed — <details>/<summary> handles open/close natively.
    // The CSS handles icon rotation via details[open] selector.
  }

  /* ─── Boot ─────────────────────────────────────────────── */

  function init() {
    initGallery();
    initVariantSelection();
    initQuantitySelector();
    initBuyButtons();
    initAccordions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
