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
 * Positioning: measures #main-header-menu-bar (the <nav> this file's
 * companion snippet, header-menu.liquid, renders) directly via
 * getBoundingClientRect() and publishes its bottom edge as
 * --showcase-menu-bottom. showcase-menu.css reads that variable for
 * the panel's `top`.
 *
 * This used to depend on assets/main-header.js publishing a shared
 * --main-header-bottom variable instead. That variable was only ever
 * set when the header had sticky mode enabled (main-header.js returns
 * early otherwise), so any store with sticky header turned off got an
 * unset variable, a 0px fallback, and a showcase-menu panel pinned to
 * the very top of the viewport, covering the header entirely.
 * Measuring the nav bar locally removes that cross-component
 * dependency so this component can't be broken by an unrelated
 * header setting again. showcase-menu.css still falls back to
 * --main-header-bottom as a last resort if it's present.
 *
 * Scroll-to-close: the header's sticky transition (assets/main-header.css,
 * .main-header--sticky-enabled.is-sticky) animates itself into place over
 * ~0.28s. Trying to keep an open panel visually glued to the header
 * through that animation isn't worth chasing — simplest fix is to just
 * close the panel as soon as scrolling starts, same as most mega-menus
 * already behave.
 *
 * This file's jobs:
 *   1. Measure + publish --showcase-menu-bottom (on load, on
 *      hover/focus of a trigger, right before a panel opens, and on
 *      resize/nav-bar-resize) so the panel is always positioned
 *      against the nav bar's current bottom edge.
 *   2. Escape close: closes the open panel and returns focus to its
 *      trigger.
 *   3. Click-outside close.
 *   4. Scroll close: closes the open panel as soon as the page scrolls.
 *   5. Touch support: first tap opens instead of navigating.
 */
(function () {
  'use strict';

  var items = document.querySelectorAll('[data-showcase-menu]');
  if (!items.length) return;

  var navBar = document.getElementById('main-header-menu-bar');
  var root = document.documentElement;
  var openItem = null;
  var rafId = null;

  function updateBottomVar() {
    if (!navBar) return;
    root.style.setProperty('--showcase-menu-bottom', navBar.getBoundingClientRect().bottom + 'px');
  }

  function scheduleUpdate() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(function () {
      rafId = null;
      updateBottomVar();
    });
  }

  function getPanel(item) {
    return item.querySelector('[data-showcase-menu-panel]');
  }
  function getTrigger(item) {
    return item.querySelector('[data-showcase-menu-trigger]');
  }

  function openMenu(item) {
    if (openItem === item) return;
    if (openItem) closeMenu(openItem);

    updateBottomVar(); // measure fresh at the moment the panel opens

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

    item.addEventListener('mouseenter', function () {
      updateBottomVar();
    });

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

    trigger.addEventListener('focus', function () {
      updateBottomVar();
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

  window.addEventListener('resize', scheduleUpdate);

  if (navBar && 'ResizeObserver' in window) {
    new ResizeObserver(scheduleUpdate).observe(navBar);
  }

  // Set an initial value on load so the var is never unset before the
  // first hover/focus/open.
  updateBottomVar();
})();