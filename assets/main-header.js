/*
 * ------------------------------------------------------------
 * main-header.js
 *
 * The sticky-positioning/spacer-sync IIFE and the scroll-driven
 * autohide IIFE live in assets/header-group.js (loaded centrally in
 * theme.liquid, before this file). Nothing here duplicates that.
 *
 * This file owns two things specific to main-header.liquid:
 *   1. The menu-bar horizontal-scroll edge-fade.
 *   2. The desktop search-icon overlay: open/close, focus management,
 *      Escape + backdrop dismissal.
 *
 * CHANGED (this pass):
 *   - Opening the overlay now also hides #header-group-wrapper
 *     entirely (adds 'is-search-active' to it — see main-header.css),
 *     instead of leaving it visible/dimmed behind a transparent or
 *     semi-transparent backdrop. The overlay carries its own compact
 *     logo + search + Cancel row (see main-header.liquid), so nothing
 *     essential is lost by hiding the real header underneath.
 *   - The trigger button now acts as a toggle: clicking it again while
 *     the overlay is already open closes it, instead of re-running
 *     open() and just re-focusing the input.
 * ------------------------------------------------------------
 */

(function () {
  'use strict';

  var menuBar = document.getElementById('main-header-menu-bar');
  if (!menuBar) return;

  var BUFFER = 1;

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
      menuBar.classList.remove('has-scroll-left', 'has-scroll-right');
      return;
    }

    menuBar.classList.toggle('has-scroll-left', el.scrollLeft > BUFFER);
    menuBar.classList.toggle('has-scroll-right', el.scrollLeft < maxScroll - BUFFER);
  };

  var scrollTarget = menuBar.querySelector('.menu-bar__container') || menuBar;

  update();
  scrollTarget.addEventListener('scroll', update, { passive: true });
  menuBar.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);

  if ('ResizeObserver' in window) {
    new ResizeObserver(update).observe(menuBar);
  }
})();

/*
 * Desktop search icon -> full-screen overlay takeover.
 * #main-header-search-trigger is only visible >=1024px (main-header.css),
 * so this can never be opened on mobile/tablet — no breakpoint check
 * needed here.
 */
(function () {
  'use strict';

  var trigger = document.getElementById('main-header-search-trigger');
  var overlay = document.getElementById('main-header-search-overlay');
  if (!trigger || !overlay) return;

  var headerGroup = document.getElementById('header-group-wrapper');
  var panel = overlay.querySelector('.main-header__search-overlay-panel');
  var input = overlay.querySelector('[data-search-input]');
  var closeEls = overlay.querySelectorAll('[data-search-overlay-close]');
  var lastFocused = null;
  var isOpen = false;
  var CLOSE_TRANSITION_MS = 200; // matches .main-header__search-overlay-panel transition duration

  function open() {
    if (isOpen) return;
    isOpen = true;
    lastFocused = document.activeElement;

    overlay.hidden = false;
    // wait a frame so the hidden -> visible change and the opacity/transform
    // transition don't collapse into a single instant jump
    requestAnimationFrame(function () {
      overlay.classList.add('is-open');
    });

    // ADDED — hide the real header entirely while search is active,
    // rather than leaving it visible (dimmed or otherwise) behind the
    // overlay. The overlay's own top row (logo + input + Cancel)
    // stands in for it.
    if (headerGroup) headerGroup.classList.add('is-search-active');

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
    if (!isOpen) return;
    isOpen = false;

    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);

    if (headerGroup) headerGroup.classList.remove('is-search-active');

    setTimeout(function () {
      overlay.hidden = true;
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }, CLOSE_TRANSITION_MS);
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      close();
      return;
    }

    if (e.key === 'Tab' && panel) {
      var focusable = panel.querySelectorAll(
        'input, button, a[href], [tabindex]:not([tabindex="-1"])'
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

  trigger.addEventListener('click', toggle);
  closeEls.forEach(function (el) {
    el.addEventListener('click', close);
  });
})();