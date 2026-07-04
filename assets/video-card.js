(function () {
  'use strict';

  function handleClick(event) {
    var trigger = event.target.closest('[data-video-trigger]');
    if (!trigger) return;

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

  document.addEventListener('click', handleClick);
})();