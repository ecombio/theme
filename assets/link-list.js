/* =============================================================================
   Link List (dropdown block) Behavior  |  assets/link-list.js
   Pairs with snippets/link-list.liquid + assets/link-list.css

   Two independent levels, same pattern at each:
     - Top-level panel:  .menu-bar__item--has-link-list  (trigger: .link-list-trigger)
     - Flyout sub-panel: .link-list-panel__item--has-sub (trigger: .link-list-panel__toggle)

   Hover-capable devices get both levels via CSS :hover (see link-list.css).
   This script adds what CSS can't cover:
     - Click / Enter / Space toggling for keyboard and touch users, at both levels
     - Escape closes the nearest open level and returns focus to its trigger
     - Clicking outside closes everything
     - Opening one item at a level closes its siblings at that level
   ============================================================================= */

(function () {
  var OPEN_CLASS = 'is-open';

  var TOP_ITEM_SELECTOR = '.menu-bar__item--has-link-list';
  var TOP_TRIGGER_SELECTOR = '.link-list-trigger';
  var SUB_ITEM_SELECTOR = '.link-list-panel__item--has-sub';
  var SUB_TOGGLE_SELECTOR = '.link-list-panel__toggle';

  function all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /* ── Generic open/close for either level ── */

  function closeItem(item, itemSelector, triggerSelector) {
    if (!item) return;
    item.classList.remove(OPEN_CLASS);
    var trigger = item.querySelector(triggerSelector);
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    // Closing a level also closes anything open beneath it
    all(SUB_ITEM_SELECTOR + '.' + OPEN_CLASS, item).forEach(function (subItem) {
      closeItem(subItem, SUB_ITEM_SELECTOR, SUB_TOGGLE_SELECTOR);
    });
  }

  function closeAll(itemSelector, triggerSelector, except) {
    all(itemSelector).forEach(function (item) {
      if (item !== except) closeItem(item, itemSelector, triggerSelector);
    });
  }

  function openItem(item, itemSelector, triggerSelector) {
    closeAll(itemSelector, triggerSelector, item);
    item.classList.add(OPEN_CLASS);
    var trigger = item.querySelector(triggerSelector);
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  }

  function toggleItem(item, itemSelector, triggerSelector) {
    if (item.classList.contains(OPEN_CLASS)) {
      closeItem(item, itemSelector, triggerSelector);
    } else {
      openItem(item, itemSelector, triggerSelector);
    }
  }

  function closeEverything() {
    closeAll(TOP_ITEM_SELECTOR, TOP_TRIGGER_SELECTOR);
  }

  /* ── Click handling ── */

  document.addEventListener('click', function (event) {
    var subToggle = event.target.closest(SUB_TOGGLE_SELECTOR);
    if (subToggle) {
      var subItem = subToggle.closest(SUB_ITEM_SELECTOR);
      if (subItem) {
        event.preventDefault();
        toggleItem(subItem, SUB_ITEM_SELECTOR, SUB_TOGGLE_SELECTOR);
      }
      return;
    }

    var topTrigger = event.target.closest(TOP_TRIGGER_SELECTOR);
    var topItem = event.target.closest(TOP_ITEM_SELECTOR);

    if (topTrigger && topItem) {
      // Only intercept when there's actually a panel to toggle;
      // otherwise let the link navigate normally (e.g. no menu assigned).
      var panel = topItem.querySelector('.link-list-panel');
      if (panel) {
        event.preventDefault();
        toggleItem(topItem, TOP_ITEM_SELECTOR, TOP_TRIGGER_SELECTOR);
      }
      return;
    }

    // Click on a real nav link (top-level or sublink) or outside entirely:
    // in both cases, nothing should stay open behind it.
    if (!event.target.closest(TOP_ITEM_SELECTOR)) {
      closeEverything();
    }
  });

  /* ── Escape: close the nearest open level first, then refocus its trigger ── */

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;

    var openSub = document.querySelector(SUB_ITEM_SELECTOR + '.' + OPEN_CLASS);
    if (openSub) {
      var subToggleEl = openSub.querySelector(SUB_TOGGLE_SELECTOR);
      closeItem(openSub, SUB_ITEM_SELECTOR, SUB_TOGGLE_SELECTOR);
      if (subToggleEl) subToggleEl.focus();
      return;
    }

    var openTop = document.querySelector(TOP_ITEM_SELECTOR + '.' + OPEN_CLASS);
    if (openTop) {
      var topTriggerEl = openTop.querySelector(TOP_TRIGGER_SELECTOR);
      closeItem(openTop, TOP_ITEM_SELECTOR, TOP_TRIGGER_SELECTOR);
      if (topTriggerEl) topTriggerEl.focus();
    }
  });
})();