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
 *   1. Keep a single CSS variable (--showcase-menu-header-h) in sync
 *      with the header's live bottom edge, and let CSS position every
 *      panel off that one variable (see .showcase-menu__panel's `top`
 *      in showcase-menu.css). Previously each open/scroll/resize event
 *      wrote panel.style.top directly, which meant several different
 *      triggers were all doing their own read+write of layout — any
 *      one of them (e.g. a countdown-timer re-render up in the
 *      announcement bar nudging the header's height) could shift the
 *      panel independently of the others, which is what caused the
 *      panel to visibly drift/jump. Now there's exactly one function
 *      that measures the header and exactly one thing it writes to.
 *   2. Escape close: closes the open panel and returns focus to its
 *      trigger.
 *   3. Click-outside close.
 *   4. Touch support: first tap opens instead of navigating.
 */
(function () {
  'use strict';

  var items = document.querySelectorAll('[data-showcase-menu]');
  if (!items.length) return;

  var header = document.getElementById('main-header');
  var openItem = null;
  var rafId = null;

  function getPanel(item) {
    return item.querySelector('[data-showcase-menu-panel]');
  }
  function getTrigger(item) {
    return item.querySelector('[data-showcase-menu-trigger]');
  }

  /* Single source of truth for "where does the header end". Every
     panel reads this via CSS (top: var(--showcase-menu-header-h)),
     so there's only ever one measurement + one write per update,
     no matter how many showcase-menu items exist on the page. */
  function updateHeaderOffset() {
    if (!header) return;
    var bottom = header.getBoundingClientRect().bottom;
    document.documentElement.style.setProperty('--showcase-menu-header-h', bottom + 'px');
  }

  function scheduleHeaderOffsetUpdate() {
    if (rafId !== null) return; // already scheduled, let the pending frame handle it
    rafId = window.requestAnimationFrame(function () {
      rafId = null;
      updateHeaderOffset();
    });
  }

  function openMenu(item) {
    if (openItem === item) return;
    if (openItem) closeMenu(openItem);

    updateHeaderOffset();

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

    item.addEventListener('mouseenter', updateHeaderOffset);

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

  // Pre-sticky scroll (e.g. an announcement bar scrolling away above a
  // sticky header) can still change the header's bottom edge even when
  // its own height doesn't change, so scroll stays as a trigger — just
  // funneled through the same rAF-throttled single update function
  // instead of writing styles directly on every scroll tick.
  window.addEventListener('scroll', scheduleHeaderOffsetUpdate, { passive: true });
  window.addEventListener('resize', scheduleHeaderOffsetUpdate);

  if (header && 'ResizeObserver' in window) {
    var ro = new ResizeObserver(scheduleHeaderOffsetUpdate);
    ro.observe(header);
  }

  updateHeaderOffset();
})();