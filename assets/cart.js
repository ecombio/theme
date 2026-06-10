  // Quantity +/- buttons update the hidden input and auto-submit
  (function () {
    var form = document.getElementById('cart-form');
    if (!form) return;

    form.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;

      var wrap  = btn.closest('.qty-control');
      var input = wrap && wrap.querySelector('.qty-control__input');
      if (!input) return;

      var val = parseInt(input.value, 10) || 0;
      if (btn.dataset.action === 'increase') {
        input.value = val + 1;
      } else if (btn.dataset.action === 'decrease' && val > 0) {
        input.value = val - 1;
      }
    });
  })();