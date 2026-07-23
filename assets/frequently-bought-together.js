(function () {
  'use strict';

  function formatMoney(cents, format) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      try {
        return window.Shopify.formatMoney(cents, format);
      } catch (e) {
        /* fall through to basic formatter below */
      }
    }
    var amount = (cents / 100).toFixed(2);
    return '$' + amount;
  }

  function initSection(section) {
    var itemsWrap = section.querySelector('[data-fbt-products]');
    var items = Array.prototype.slice.call(section.querySelectorAll('[data-fbt-item]'));
    var totalEl = section.querySelector('[data-fbt-total]');
    var addButton = section.querySelector('[data-fbt-add-button]');
    var buttonText = section.querySelector('[data-fbt-button-text]');
    var messageEl = section.querySelector('[data-fbt-message]');
    var moneyFormat = (window.theme && window.theme.moneyFormat) || null;
    var labelTemplate = (addButton && addButton.getAttribute('data-label-template')) || 'Add all [count] to Cart';

    if (!itemsWrap || !addButton) return;

    function getItemState(item) {
      var checkbox = item.querySelector('input[type="checkbox"]');
      var select = item.querySelector('[data-fbt-variant-select]');
      var checked = checkbox ? checkbox.checked : true;
      var variantId = select ? select.value : item.getAttribute('data-variant-id');
      var price = select
        ? parseInt(select.options[select.selectedIndex].getAttribute('data-price'), 10)
        : parseInt(item.getAttribute('data-price'), 10);

      return {
        checked: checked,
        variantId: variantId,
        price: isNaN(price) ? 0 : price
      };
    }

    function updateButtonLabel(count) {
      if (buttonText) {
        buttonText.textContent = labelTemplate.replace('[count]', count);
      }
    }

    function recalcTotal() {
      var total = 0;
      var count = 0;

      items.forEach(function (item) {
        var state = getItemState(item);
        if (state.checked && state.variantId) {
          total += state.price;
          count += 1;
        }
      });

      if (totalEl) {
        totalEl.textContent = formatMoney(total, moneyFormat);
      }

      updateButtonLabel(count);
      addButton.disabled = count === 0;
    }

    function updateItemPriceDisplay(item) {
      var priceWrap = item.querySelector('[data-fbt-price]');
      var state = getItemState(item);
      if (!priceWrap) return;

      var moneyStr = formatMoney(state.price, moneyFormat);
      var wholeLen = moneyStr.length - 3;
      var symbol = moneyStr.slice(0, 1);
      var whole = moneyStr.slice(1, wholeLen);
      var decimal = moneyStr.slice(wholeLen);

      priceWrap.innerHTML =
        '<span class="fbt-item-price__symbol">' + symbol + '</span>' +
        '<span class="fbt-item-price__whole">' + whole + '</span>' +
        '<span class="fbt-item-price__decimal">' + decimal + '</span>';
    }

    items.forEach(function (item) {
      var checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox && !checkbox.disabled) {
        checkbox.addEventListener('change', function () {
          item.setAttribute('data-fbt-disabled', checkbox.checked ? 'false' : 'true');
          recalcTotal();
        });
      }

      var select = item.querySelector('[data-fbt-variant-select]');
      if (select) {
        select.addEventListener('change', function () {
          item.setAttribute('data-variant-id', select.value);
          item.setAttribute('data-price', select.options[select.selectedIndex].getAttribute('data-price'));
          updateItemPriceDisplay(item);
          recalcTotal();
        });
      }
    });

    function setMessage(text, state) {
      if (!messageEl) return;
      messageEl.textContent = text || '';
      if (state) {
        messageEl.setAttribute('data-state', state);
      } else {
        messageEl.removeAttribute('data-state');
      }
    }

    function setLoading(isLoading) {
      addButton.disabled = isLoading;
      addButton.setAttribute('data-loading', isLoading ? 'true' : 'false');

      if (isLoading && buttonText) {
        addButton.setAttribute('data-restore-label', buttonText.textContent);
        buttonText.textContent = 'Adding…';
      } else if (buttonText && addButton.getAttribute('data-restore-label')) {
        buttonText.textContent = addButton.getAttribute('data-restore-label');
      }
    }

    addButton.addEventListener('click', function () {
      var toAdd = [];

      items.forEach(function (item) {
        var state = getItemState(item);
        if (state.checked && state.variantId) {
          toAdd.push({ id: parseInt(state.variantId, 10), quantity: 1 });
        }
      });

      if (!toAdd.length) {
        setMessage('Select at least one product to add.', 'error');
        return;
      }

      setLoading(true);
      setMessage('');

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: toAdd })
      })
        .then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) {
              var errMessage = (data && data.description) || 'Could not add items to cart.';
              throw new Error(errMessage);
            }
            return data;
          });
        })
        .then(function () {
          setMessage('Added to cart!', 'success');
          document.dispatchEvent(
            new CustomEvent('cart:updated', { bubbles: true, detail: { source: 'frequently-bought-together' } })
          );
          document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
        })
        .catch(function (error) {
          setMessage(error.message || 'Something went wrong. Please try again.', 'error');
        })
        .finally(function () {
          setLoading(false);
        });
    });

    recalcTotal();
  }

  function init() {
    var sections = document.querySelectorAll('[data-fbt-section]');
    sections.forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('[data-fbt-section]');
    if (section) initSection(section);
  });
})();