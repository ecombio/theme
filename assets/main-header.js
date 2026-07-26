/*
 * ------------------------------------------------------------
 * main-header.js
 *
 * CHANGED — the sticky-positioning/spacer-sync IIFE and the
 * scroll-driven autohide IIFE that used to live in this file have moved
 * to assets/header-group.js. Both were generalized to work for any
 * section in config/header-group.json (not just this one hardcoded to
 * the announcement bar) and now key off #shopify-section-group-header-group
 * rather than #main-header alone. See header-group.js for that logic.
 *
 * header-group.js must load BEFORE this file (see the script tags in
 * sections/main-header.liquid) so window.__headerGroupSync exists if
 * anything here ever needs to trigger a re-sync.
 *
 * The only thing that remains here is the menu-bar horizontal-scroll
 * edge-fade — that one is genuinely main-header-specific (it targets
 * #main-header-menu-bar, rendered only by this section's block loop) and
 * has nothing to do with header-group stacking.
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
