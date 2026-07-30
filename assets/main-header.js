/*
 * ------------------------------------------------------------
 * main-header.js
 *
 * The sticky-positioning/spacer-sync IIFE and the scroll-driven
 * autohide IIFE live in assets/header-group.js (loaded centrally in
 * theme.liquid, before this file). Nothing here duplicates that.
 *
 * This file owns two things specific to main-header.liquid:
 *   1. The menu-bar horizontal-scroll edge-fade (unchanged from
 *      before — targets #main-header-menu-bar, rendered by
 *      header-menu.liquid regardless of where in the DOM it sits).
 *   2. ADDED — the desktop search-icon overlay: open/close, focus
 *      management, Escape + backdrop dismissal. It does not touch
 *      header-search.js — focusing the input on open is enough to
 *      trigger the existing trending/recent-searches panel, since
 *      that's already wired to the input's native focus event there.
 * ------------------------------------------------------------
 */

/*
 * FIX — menu-bar.has-scroll-left / has-scroll-right (main-header.css) and
 * the .menu-bar__edge-fade--left / --right elements (header-menu.liquid)
 * were both already in place, but nothing ever toggled those classes, so
 * the white edge-fade never appeared regardless of overflow state. This
 * lives here (rather than inside mega-menu.js / showcase.js / link-list.js)
 * because .menu-bar renders whenever section.blocks.size > 0, independent
 * of which block types are present — those three scripts only load
 * conditionally per block type and can't be relied on to cover every case.
 *
 * The actual scrolling element changes by breakpoint:
 *   - >=1024px: overflow-x lives on .menu-bar__container
 *   - <640px with .main-header--menu-bar-mobile-visible: overflow-x lives
 *     on .menu-bar itself
 * getScrollEl() below picks whichever one is actually overflowing.
 */
(function () {
  'use strict';

  var menuBar = document.getElementById('main-header-menu-bar');
  if (!menuBar) return;

  var BUFFER = 1; // guards against sub-pixel scrollLeft/maxScroll mismatches at the true end

  var getScrollEl = function () {
    var container = menuBar.querySelector('.menu-bar__container');
    if (container && container.scrollWidth > container.clientWidth) return container;
    if (menuBar.scrollWidth > menuBar.clientWidth) return menuBar;
    return container || menuBar;
  };

  var update = function () {
    var el = getScrollEl();
    var maxScroll = el.scrollWidth - el.clientWidth;

    if (maxScroll <= BUFFER) {
      // nothing to scroll in either direction — no fade either side
      menuBar.classList.remove('has-scroll-left', 'has-scroll-right');
      return;
    }

    menuBar.classList.toggle('has-scroll-left', el.scrollLeft > BUFFER);
    menuBar.classList.toggle('has-scroll-right', el.scrollLeft < maxScroll - BUFFER);
  };

  var scrollTarget = menuBar.querySelector('.menu-bar__container') || menuBar;

  update();
  scrollTarget.addEventListener('scroll', update, { passive: true });
  menuBar.addEventListener('scroll', update, { passive: true }); // covers the <640px mobile-visible case where .menu-bar itself scrolls
  window.addEventListener('resize', update);

  if ('ResizeObserver' in window) {
    new ResizeObserver(update).observe(menuBar);
  }
})();

/*
 * ADDED — desktop search icon -> full-screen overlay takeover.
 * #main-header-search-trigger is only visible >=1024px (main-header.css),
 * so this can never be opened on mobile/tablet — no breakpoint check
 * needed here.
 */
(function () {
  'use strict';

  var trigger = document.getElementById('main-header-search-trigger');
  var overlay = document.getElementById('main-header-search-overlay');
  if (!trigger || !overlay) return;

  var panel = overlay.querySelector('.main-header__search-overlay-panel');
  var input = overlay.querySelector('[data-search-input]');
  var closeEls = overlay.querySelectorAll('[data-search-overlay-close]');
  var lastFocused = null;
  var CLOSE_TRANSITION_MS = 200; // matches .main-header__search-overlay-panel transition duration

  function open() {
    lastFocused = document.activeElement;

    overlay.hidden = false;
    // wait a frame so the hidden -> visible change and the opacity/transform
    // transition don't collapse into a single instant jump
    requestAnimationFrame(function () {
      overlay.classList.add('is-open');
    });

    trigger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';

    if (input) {
      // header-search.js already shows the trending/recent-searches panel
      // on the input's focus event, so focusing it here is all that's
      // needed to populate the overlay — no extra wiring required.
      setTimeout(function () { input.focus(); }, 50);
    }

    document.addEventListener('keydown', onKeydown);
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);

    setTimeout(function () {
      overlay.hidden = true;
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }, CLOSE_TRANSITION_MS);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      close();
      return;
    }

    if (e.key === 'Tab' && panel) {
      // simple focus trap — keeps Tab/Shift+Tab cycling within the panel
      var focusable = panel.querySelectorAll(
        'input, button, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  trigger.addEventListener('click', open);
  closeEls.forEach(function (el) {
    el.addEventListener('click', close);
  });
})();