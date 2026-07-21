window.BlogMenuItem = (function () {
  'use strict';

  function getDropdown(item) {
    return item.querySelector('.blog-menu__dropdown');
  }

  function positionDropdown(nav, btn, dropdown) {
    var navRect = nav.getBoundingClientRect();
    var btnRect = btn.getBoundingClientRect();
    dropdown.style.top = (btnRect.bottom - navRect.top + 6) + 'px';
    dropdown.style.left = (btnRect.left - navRect.left) + 'px';
  }

  function openDropdown(nav, btn, item) {
    var dropdown = getDropdown(item);
    if (!dropdown || dropdown.classList.contains('blog-menu__dropdown--portal')) return;

    var placeholder = document.createComment('blog-menu-dropdown-slot');
    item.replaceChild(placeholder, dropdown);
    item._dropdownPlaceholder = placeholder;

    dropdown.classList.add('blog-menu__dropdown--portal');
    nav.appendChild(dropdown);
    positionDropdown(nav, btn, dropdown);
  }

  function closeDropdown(nav, item) {
    var dropdown = nav.querySelector('.blog-menu__dropdown--portal');
    var placeholder = item._dropdownPlaceholder;
    if (!dropdown || !placeholder || !placeholder.parentNode) return;

    dropdown.classList.remove('blog-menu__dropdown--portal');
    dropdown.style.top = '';
    dropdown.style.left = '';
    placeholder.parentNode.replaceChild(dropdown, placeholder);
    item._dropdownPlaceholder = null;
  }

  function closeAllDropdowns(nav, exceptItem) {
    nav.querySelectorAll('[data-blog-menu-dropdown-toggle]').forEach(function (btn) {
      var item = btn.closest('.blog-menu__item--list');
      if (item === exceptItem) return;
      item.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      closeDropdown(nav, item);
    });
  }

  function init(nav) {
    var list = nav.querySelector('[data-blog-menu-list]');

    nav.querySelectorAll('[data-blog-menu-dropdown-toggle]').forEach(function (btn) {
      var item = btn.closest('.blog-menu__item--list');

      btn.addEventListener('click', function (event) {
        event.stopPropagation();
        var willOpen = !item.classList.contains('is-open');
        closeAllDropdowns(nav, willOpen ? item : null);
        item.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));

        if (willOpen) {
          openDropdown(nav, btn, item);
        } else {
          closeDropdown(nav, item);
        }
      });

      btn.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          item.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
          closeDropdown(nav, item);
          btn.focus();
        }
      });
    });

    document.addEventListener('click', function (event) {
      if (!nav.contains(event.target)) {
        closeAllDropdowns(nav, null);
      }
    });

    function repositionOpen() {
      var openItem = nav.querySelector('.blog-menu__item--list.is-open');
      if (!openItem) return;
      var btn = openItem.querySelector('[data-blog-menu-dropdown-toggle]');
      var dropdown = nav.querySelector('.blog-menu__dropdown--portal');
      if (btn && dropdown) positionDropdown(nav, btn, dropdown);
    }

    if (list) {
      list.addEventListener('scroll', repositionOpen, { passive: true });
    }
    window.addEventListener('resize', repositionOpen);
  }

  return { init: init };
})();