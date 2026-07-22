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

  function splitPrice(cents, moneyFormat) {
    var moneyStr = formatMoney(cents, moneyFormat);
    var wholeLen = moneyStr.length - 3;
    return {
      symbol: moneyStr.slice(0, 1),
      whole: moneyStr.slice(1, wholeLen),
      decimal: moneyStr.slice(wholeLen)
    };
  }

  function escapeHtml(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function imageUrl(url, width) {
    if (!url) return '';
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 'width=' + width;
  }

  function pickVariant(product) {
    if (!product.variants || !product.variants.length) return null;
    var available = product.variants.filter(function (v) { return v.available; });
    return available.length ? available[0] : product.variants[0];
  }

  // Builds one .fbt-item element for a related product from the JSON
  // recommendations response. Mirrors the markup the Liquid template
  // used to render server-side for each metafield-referenced product.
  function buildRelatedItem(product, index, moneyFormat) {
    var variant = pickVariant(product);
    var price = variant ? variant.price : (product.price || 0);
    var priceParts = splitPrice(price, moneyFormat);
    var checkboxId = 'fbt-check-related-' + index;
    var image = product.featured_image || (product.images && product.images[0]) || '';
    var available = product.available !== false;

    var wrap = document.createElement('div');
    wrap.className = 'fbt-item';
    wrap.setAttribute('data-fbt-item', '');
    wrap.setAttribute('data-product-id', product.id);
    wrap.setAttribute('data-variant-id', variant ? variant.id : '');
    wrap.setAttribute('data-price', price);
    if (!available) wrap.setAttribute('data-fbt-disabled', 'true');

    var variantOptionsHtml = '';
    if (product.variants && product.variants.length > 1) {
      variantOptionsHtml = product.variants
        .map(function (v) {
          return (
            '<option value="' + v.id + '" data-price="' + v.price + '"' +
            (!v.available ? ' disabled' : '') +
            (variant && v.id === variant.id ? ' selected' : '') +
            '>' + escapeHtml(v.title) + (!v.available ? ' - Sold out' : '') + '</option>'
          );
        })
        .join('');
    }

    wrap.innerHTML =
      '<a href="' + product.url + '" class="fbt-item-image" tabindex="-1">' +
        (image
          ? '<img src="' + imageUrl(image, 300) + '" alt="' + escapeHtml(product.title) + '" loading="lazy" width="150" height="150">'
          : '<div class="fbt-item-image--placeholder"></div>') +
        '<span class="fbt-item-checkbox">' +
          '<input type="checkbox" id="' + checkboxId + '" data-fbt-checkbox' + (available ? ' checked' : ' disabled') + '>' +
          '<label for="' + checkboxId + '"></label>' +
        '</span>' +
      '</a>' +
      '<div class="fbt-item-info">' +
        '<a href="' + product.url + '" class="fbt-item-title fbt-item-title--link">' + escapeHtml(product.title) + '</a>' +
        (!available
          ? '<span class="fbt-item-soldout">Currently unavailable</span>'
          : (variantOptionsHtml
              ? '<select class="fbt-variant-select" data-fbt-variant-select aria-label="' + escapeHtml(product.title) + ' variant">' + variantOptionsHtml + '</select>'
              : '') +
            '<span class="fbt-item-price" data-fbt-price>' +
              '<span class="fbt-item-price__symbol">' + priceParts.symbol + '</span>' +
              '<span class="fbt-item-price__whole">' + priceParts.whole + '</span>' +
              '<span class="fbt-item-price__decimal">' + priceParts.decimal + '</span>' +
            '</span>') +
      '</div>';

    return wrap;
  }

  // Wires checkboxes / variant selects / add-to-cart once the item
  // markup (main item + any related items) is in the DOM.
  function wireInteractions(section) {
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

      var parts = splitPrice(state.price, moneyFormat);
      priceWrap.innerHTML =
        '<span class="fbt-item-price__symbol">' + parts.symbol + '</span>' +
        '<span class="fbt-item-price__whole">' + parts.whole + '</span>' +
        '<span class="fbt-item-price__decimal">' + parts.decimal + '</span>';
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

  // Fetches Complementary Products as plain JSON, builds the related
  // item markup, and reveals either the results or an empty-state
  // message. Every outcome is logged to the console — open devtools
  // if the section still doesn't show up.
  function loadRecommendations(section) {
    var productId = section.getAttribute('data-product-id');
    var limit = section.getAttribute('data-limit') || 3;
    var moneyFormat = (window.theme && window.theme.moneyFormat) || null;

    var productsWrap = section.querySelector('[data-fbt-products]');
    var content = section.querySelector('[data-fbt-content]');
    var skeleton = section.querySelector('[data-fbt-skeleton]');
    var emptyEl = section.querySelector('[data-fbt-empty]');

    if (!productId || !productsWrap) {
      console.error('[FBT] section is missing data-product-id or [data-fbt-products]');
      return;
    }

    var url =
      '/recommendations/products.json?product_id=' + encodeURIComponent(productId) +
      '&limit=' + encodeURIComponent(limit) +
      '&intent=complementary';

    console.log('[FBT] requesting', url);

    fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Recommendations request failed with status ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        var products = (data && data.products) || [];
        console.log('[FBT] received', products.length, 'complementary product(s):', products);

        var related = products.filter(function (p) {
          return String(p.id) !== String(productId);
        });

        if (!related.length) {
          if (skeleton) skeleton.hidden = true;
          if (emptyEl) emptyEl.hidden = false;
          return;
        }

        related.forEach(function (product, i) {
          var plus = document.createElement('div');
          plus.className = 'fbt-plus';
          plus.setAttribute('aria-hidden', 'true');
          plus.textContent = '+';
          productsWrap.appendChild(plus);
          productsWrap.appendChild(buildRelatedItem(product, i, moneyFormat));
        });

        if (skeleton) skeleton.hidden = true;
        if (content) content.hidden = false;
        wireInteractions(section);
      })
      .catch(function (error) {
        console.error('[FBT] failed to load complementary products:', error);
        if (skeleton) skeleton.hidden = true;
        if (emptyEl) {
          emptyEl.hidden = false;
          emptyEl.textContent = 'Could not load recommendations right now.';
        }
      });
  }

  function init() {
    var sections = document.querySelectorAll('[data-fbt-section]');
    sections.forEach(loadRecommendations);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('[data-fbt-section]');
    if (section) loadRecommendations(section);
  });
})();