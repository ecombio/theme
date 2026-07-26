(function () {
  'use strict';

  function getPlayTrigger(target) {
    var trigger = target.closest('[data-video-trigger]');
    if (!trigger || trigger.getAttribute('aria-disabled') === 'true') return null;
    return trigger;
  }

  function dispatchPlay(trigger) {
    var card = trigger.closest('[data-video-card]');
    if (!card) return;

    var productTemplate = card.querySelector('[data-video-product-template]');

    document.dispatchEvent(new CustomEvent('video-card:play', {
      detail: {
        type: card.getAttribute('data-video-type'),
        id: card.getAttribute('data-video-id'),
        fileUrl: card.getAttribute('data-video-file-url'),
        triggerEl: trigger,
        hasProduct: !!productTemplate,
        productHTML: productTemplate ? productTemplate.innerHTML : null
      }
    }));
  }

  function addToCart(button) {
    var variantId = button.getAttribute('data-variant-id');
    if (!variantId || button.disabled) return;

    button.disabled = true;
    var originalLabel = button.innerHTML;

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Add to cart failed');
        return response.json();
      })
      .then(function (item) {
        button.classList.add('is-added');
        document.dispatchEvent(new CustomEvent('video-card:added-to-cart', { detail: { variantId: variantId, item: item } }));
        setTimeout(function () {
          button.classList.remove('is-added');
          button.disabled = false;
          button.innerHTML = originalLabel;
        }, 1500);
      })
      .catch(function () {
        button.disabled = false;
        document.dispatchEvent(new CustomEvent('video-card:add-to-cart-error', { detail: { variantId: variantId } }));
      });
  }

  document.addEventListener('click', function (event) {
    var addBtn = event.target.closest('[data-add-to-cart]');
    if (addBtn) {
      event.preventDefault();
      event.stopPropagation();
      addToCart(addBtn);
      return;
    }

    var trigger = getPlayTrigger(event.target);
    if (trigger) dispatchPlay(trigger);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('[data-add-to-cart]')) return; // native <button> already handles this

    var trigger = getPlayTrigger(event.target);
    if (!trigger) return;

    event.preventDefault();
    dispatchPlay(trigger);
  });
})();