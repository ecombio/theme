(function () {
  'use strict';

  function dispatchPlay(trigger) {
    var card = trigger.closest('[data-video-card]');
    if (!card) return;

    var productTemplate = card.querySelector('[data-video-product-template]');

    var detail = {
      type: card.getAttribute('data-video-type'),
      id: card.getAttribute('data-video-id'),
      fileUrl: card.getAttribute('data-video-file-url'),
      triggerEl: trigger,
      hasProduct: !!productTemplate,
      productHTML: productTemplate ? productTemplate.innerHTML : null
    };

    document.dispatchEvent(new CustomEvent('video-card:play', { detail: detail }));
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
        document.dispatchEvent(
          new CustomEvent('video-card:added-to-cart', { detail: { variantId: variantId, item: item } })
        );
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

  function handleClick(event) {
    var addBtn = event.target.closest('[data-add-to-cart]');
    if (addBtn) {
      event.preventDefault();
      event.stopPropagation();
      addToCart(addBtn);
      return;
    }

    var trigger = event.target.closest('[data-video-trigger]');
    if (!trigger || trigger.getAttribute('aria-disabled') === 'true') return;
    dispatchPlay(trigger);
  }

  function handleKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    var addBtn = event.target.closest('[data-add-to-cart]');
    if (addBtn) return; // native <button> already handles this

    var trigger = event.target.closest('[data-video-trigger]');
    if (!trigger || trigger.getAttribute('aria-disabled') === 'true') return;

    event.preventDefault();
    dispatchPlay(trigger);
  }

  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);
})();