/**
 * Showcase Menu
 * File: assets/showcase-menu.js
 * Loaded by: snippets/header-menu.liquid (only when a showcase-menu
 * block is present)
 *
 * Same responsibilities as mega-menu.js, kept as a separate file/data
 * attribute namespace (data-showcase-menu* vs data-mega-menu*) on
 * purpose — a store with only mega-menu blocks never loads this file,
 * a store with only showcase-menu blocks never loads mega-menu.js, and
 * the two panels' open/close state can never cross-contaminate each
 * other even if both appear in the same menu bar.
 *
 * Positioning: this file used to measure the header itself (its own
 * scroll/resize/ResizeObserver listeners writing panel.style.top
 * directly). That's gone now — assets/main-header.js is the single
 * place that measures the header's live bottom edge and keeps it in
 * --main-header-bottom, and showcase-menu.css just reads that variable
 * (`top: var(--main-header-bottom)`).
 *
 * Scroll-to-close: the header's sticky transition (assets/main-header.css,
 * .main-header--sticky-enabled.is-sticky) animates itself into place over
 * ~0.28s, but --main-header-bottom updates to the new value immediately.
 * Trying to keep an open panel visually glued to the header through that
 * animation isn't worth chasing — simplest fix is to just close the panel
 * as soon as scrolling starts, same as most mega-menus already behave.
 *
 * This file's remaining jobs:
 *   1. Escape close: closes the open panel and returns focus to its
 *      trigger.
 *   2. Click-outside close.
 *   3. Scroll close: closes the open panel as soon as the page scrolls.
 *   4. Touch support: first tap opens instead of navigating.
 */
(function () {
  'use strict';

  var items = document.querySelectorAll('[data-showcase-menu]');
  if (!items.length) return;

  var openItem = null;

  function getPanel(item) {
    return item.querySelector('[data-showcase-menu-panel]');
  }
  function getTrigger(item) {
    return item.querySelector('[data-showcase-menu-trigger]');
  }

  function openMenu(item) {
    if (openItem === item) return;
    if (openItem) closeMenu(openItem);

    var panel = getPanel(item);
    var trigger = getTrigger(item);
    panel.classList.add('is-open');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    openItem = item;
  }

  function closeMenu(item) {
    var panel = getPanel(item);
    var trigger = getTrigger(item);
    if (panel) panel.classList.remove('is-open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (openItem === item) openItem = null;
  }

  items.forEach(function (item) {
    var trigger = getTrigger(item);
    var panel = getPanel(item);
    if (!trigger || !panel) return;

    item.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        closeMenu(item);
        trigger.focus();
      }
    });

    trigger.addEventListener('click', function (event) {
      var isOpen = panel.classList.contains('is-open');
      if (!isOpen && window.matchMedia('(hover: none)').matches) {
        event.preventDefault();
        openMenu(item);
      }
    });
  });

  document.addEventListener('click', function (event) {
    if (openItem && !openItem.contains(event.target)) {
      closeMenu(openItem);
    }
  });

  // Close on scroll rather than trying to track the header's sticky
  // slide-in animation — see file header comment above.
  window.addEventListener('scroll', function () {
    if (openItem) closeMenu(openItem);
  }, { passive: true });
})();