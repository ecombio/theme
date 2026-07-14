(function () {
  'use strict';

  var WISHLIST_KEY = 'shopify_wishlist';
  var COUNT_SEL     = '[data-wishlist-count]';
  var HIDDEN_CLS    = 'header-wishlist__badge--hidden';
  var POP_CLS       = 'header-wishlist__badge--pop';

  function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; } catch (e) { return []; }
  }

  function getCount() {
    return getWishlist().filter(function (entry) {
      return typeof entry === 'object' && entry !== null && (entry.id || entry.handle);
    }).length;
  }

  function updateBadges(count, animate) {
    document.querySelectorAll(COUNT_SEL).forEach(function (el) {
      el.textContent = String(count);
      el.classList.toggle(HIDDEN_CLS, count === 0);

      if (animate && count > 0) {
        el.classList.remove(POP_CLS);
        void el.offsetWidth;
        el.classList.add(POP_CLS);
        el.addEventListener(
          'animationend',
          function () { el.classList.remove(POP_CLS); },
          { once: true }
        );
      }
    });
  }

  function sync(animate) {
    updateBadges(getCount(), animate);
  }

  function init() {
    sync(false);

    document.addEventListener('wishlist:toggle', function () { sync(true); });
    document.addEventListener('wishlist:cleared', function () { sync(false); });

    window.addEventListener('storage', function (e) {
      if (e.key === WISHLIST_KEY) sync(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());