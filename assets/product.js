/**
 * Product Page JavaScript
 * Handles gallery interactions, variant selection, quantity updates, and buy button functionality
 */

class ProductPage {
  constructor() {
    this.initGallery();
    this.initVariantSelection();
    this.initQuantitySelector();
    this.initBuyButtons();
  }

  /**
   * Initialize product gallery functionality
   */
  initGallery() {
    const thumbnails = document.querySelectorAll('.thumbnail-item');
    const mainImage = document.querySelector('.main-image');

    if (!thumbnails.length || !mainImage) return;

    thumbnails.forEach((thumbnail) => {
      thumbnail.addEventListener('click', (e) => {
        // Remove active class from all thumbnails
        thumbnails.forEach(t => t.classList.remove('active'));
        
        // Add active class to clicked thumbnail
        thumbnail.classList.add('active');

        // Get the corresponding image
        const mediaId = thumbnail.dataset.mediaId;
        const img = thumbnail.querySelector('img');
        
        if (img) {
          // Update main image
          const largeSrc = img.src.replace('width=84', 'width=787');
          mainImage.src = largeSrc;
          mainImage.alt = img.alt;
        }
      });

      // Add keyboard support
      thumbnail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          thumbnail.click();
        }
      });
    });
  }

  /**
   * Initialize variant selection
   */
  initVariantSelection() {
    const variantInputs = document.querySelectorAll('.variant-radio, .color-input');
    const selectedValueSpans = document.querySelectorAll('.selected-value');

    if (!variantInputs.length) return;

    variantInputs.forEach((input) => {
      input.addEventListener('change', (e) => {
        const optionName = e.target.name;
        const optionValue = e.target.value;

        // Update selected value display
        const valueSpan = Array.from(selectedValueSpans).find(
          span => span.closest('.variant-option').querySelector(`[name="${optionName}"]`)
        );
        
        if (valueSpan) {
          valueSpan.textContent = optionValue;
        }

        // Update URL and form
        this.updateVariant();
      });
    });
  }

  /**
   * Update selected variant
   */
  updateVariant() {
    const form = document.querySelector('.product-form');
    if (!form) return;

    // Get all selected options
    const selectedOptions = {};
    const variantInputs = document.querySelectorAll('.variant-radio:checked, .color-input:checked');
    
    variantInputs.forEach(input => {
      selectedOptions[input.name] = input.value;
    });

    // In a real Shopify implementation, you would:
    // 1. Find the matching variant based on selected options
    // 2. Update the hidden variant ID input
    // 3. Update price display
    // 4. Update availability
    // 5. Update URL with variant parameter
    
    console.log('Selected options:', selectedOptions);
  }

  /**
   * Initialize quantity selector
   */
  initQuantitySelector() {
    const quantityInput = document.querySelector('.quantity-input');
    const minusButton = document.querySelector('.quantity-button[name="minus"]');
    const plusButton = document.querySelector('.quantity-button[name="plus"]');

    if (!quantityInput || !minusButton || !plusButton) return;

    minusButton.addEventListener('click', () => {
      const currentValue = parseInt(quantityInput.value) || 1;
      if (currentValue > 1) {
        quantityInput.value = currentValue - 1;
      }
    });

    plusButton.addEventListener('click', () => {
      const currentValue = parseInt(quantityInput.value) || 1;
      quantityInput.value = currentValue + 1;
    });

    // Ensure valid input
    quantityInput.addEventListener('change', () => {
      const value = parseInt(quantityInput.value) || 1;
      quantityInput.value = Math.max(1, value);
    });
  }

  /**
   * Initialize buy buttons
   */
  initBuyButtons() {
    const buyNowButton = document.querySelector('.buy-now');
    const addToCartButton = document.querySelector('.add-to-cart');

    if (buyNowButton) {
      buyNowButton.addEventListener('click', (e) => {
        e.preventDefault();
        
        // In a real Shopify implementation, this would:
        // 1. Add the product to cart
        // 2. Redirect to checkout
        
        const form = document.querySelector('.product-form');
        if (form) {
          const formData = new FormData(form);
          console.log('Buy Now clicked with:', Object.fromEntries(formData));
          
          // Redirect to checkout (Shopify specific)
          // window.location.href = '/checkout';
        }
      });
    }

    if (addToCartButton) {
      const form = addToCartButton.closest('form');
      
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          
          const formData = new FormData(form);
          
          // In a real Shopify implementation, this would use the AJAX API:
          // fetch('/cart/add.js', {
          //   method: 'POST',
          //   body: formData
          // })
          // .then(response => response.json())
          // .then(data => {
          //   // Show success message
          //   // Update cart count
          // });
          
          console.log('Add to Cart clicked with:', Object.fromEntries(formData));
          
          // Show temporary success message
          const originalText = addToCartButton.textContent;
          addToCartButton.textContent = 'Added to Cart!';
          addToCartButton.style.backgroundColor = '#4CAF50';
          
          setTimeout(() => {
            addToCartButton.textContent = originalText;
            addToCartButton.style.backgroundColor = '';
          }, 2000);
        });
      }
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ProductPage();
  });
} else {
  new ProductPage();
}

// Add accordion functionality
document.addEventListener('DOMContentLoaded', () => {
  const accordions = document.querySelectorAll('details');
  
  accordions.forEach(accordion => {
    const summary = accordion.querySelector('summary');
    
    if (summary) {
      summary.addEventListener('click', (e) => {
        // Optional: Close other accordions when opening one
        // const isOpen = accordion.hasAttribute('open');
        // if (!isOpen) {
        //   accordions.forEach(acc => {
        //     if (acc !== accordion) acc.removeAttribute('open');
        //   });
        // }
      });
    }
  });
});
