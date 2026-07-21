window.BlogMenuItem = (function () {
  'use strict';

  function closeAllDropdowns(nav, exceptItem) {
    nav.querySelectorAll('[data-blog-menu-dropdown-toggle]').forEach(function (btn) {
      var item = btn.closest('.blog-menu__item--list');
      if (item === exceptItem) return;
      item.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function init(nav) {
    nav.querySelectorAll('[data-blog-menu-dropdown-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.stopPropagation();
        var item = btn.closest('.blog-menu__item--list');
        var willOpen = !item.classList.contains('is-open');
        closeAllDropdowns(nav, willOpen ? item : null);
        item.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
      });

      btn.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          var item = btn.closest('.blog-menu__item--list');
          item.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        }
      });
    });

    document.addEventListener('click', function (event) {
      if (!nav.contains(event.target)) {
        closeAllDropdowns(nav, null);
      }
    });
  }

  return { init: init };
})();