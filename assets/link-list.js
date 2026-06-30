/* =============================================================================
   Link List (dropdown block) Behavior  |  assets/link-list.js
   Pairs with blocks/link-list.liquid + assets/link-list.css

   Desktop mouse users get the panel via CSS :hover (no JS needed there).
   This script adds what :hover can't cover:
     - Click / Enter / Space toggling for keyboard and touch users
     - Escape closes the open panel and returns focus to the trigger
     - Clicking outside closes any open panel
     - Opening one link-list closes any other open one
   ============================================================================= */

(function () {
  var OPEN_CLASS = 'is-open';

  function getItems() {
    return Array.prototype.slice.call(
      document.querySelectorAll('.menu-bar__item--has-link-list')
    );
  }

  function closeItem(item) {
    if (!item) return;
    item.classList.remove(OPEN_CLASS);
    var trigger = item.querySelector('.link-list-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function closeAll(except) {
    getItems().forEach(function (item) {
      if (item !== except) closeItem(item);
    });
  }

  function openItem(item) {
    closeAll(item);
    item.classList.add(OPEN_CLASS);
    var trigger = item.querySelector('.link-list-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  }

  function toggleItem(item) {
    if (item.classList.contains(OPEN_CLASS)) {
      closeItem(item);
    } else {
      openItem(item);
    }
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('.link-list-trigger');
    var item = event.target.closest('.menu-bar__item--has-link-list');

    if (trigger && item) {
      // Only intercept the click when there's actually a panel to toggle;
      // otherwise let the link navigate normally (e.g. no menu assigned).
      var panel = item.querySelector('.link-list-panel');
      if (panel) {
        event.preventDefault();
        toggleItem(item);
      }
      return;
    }

    // Click outside any link-list item closes everything open
    if (!event.target.closest('.menu-bar__item--has-link-list')) {
      closeAll();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var openItemEl = document.querySelector('.menu-bar__item--has-link-list.is-open');
    if (!openItemEl) return;
    var trigger = openItemEl.querySelector('.link-list-trigger');
    closeItem(openItemEl);
    if (trigger) trigger.focus();
  });
})();