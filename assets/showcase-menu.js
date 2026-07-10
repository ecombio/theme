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
 * the panel's `top` (and now also the backdrop's `top`).
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
 * FIXED (openItem never tracked on desktop hover): the panel actually
 * opens on desktop purely via CSS (:hover / :focus-within in
 * showcase-menu.css) — this file previously only called openMenu() for
 * touch devices (the `matchMedia('(hover: none)')` branch in the
 * trigger's click handler). That meant `openItem` stayed null for
 * every mouse hover, so the scroll-close listener's
 * `if (openItem) scrollCloseMenu(openItem)` was always a no-op on
 * desktop — the panel just stayed visually open (via CSS) while the
 * page scrolled and the header autohid underneath it, since nothing
 * was ever telling the panel or the header about the open state.
 * mouseenter/focus now set openItem directly (not through openMenu(),
 * which does its own is-open bookkeeping this doesn't need since CSS
 * already handles the visual open state) so scroll-close, escape, and
 * click-outside all work correctly with mouse/keyboard too.
 *
 * ADDED (header pin while panel is open): mouseenter/focus now also
 * add main-header--menu-panel-open to <header id="main-header">, and
 * mouseleave/focusout remove it. assets/main-header.js's autohide
 * scroll handler checks for this class and skips hiding the header
 * while it's present — see the comment block in that file. This is
 * what keeps the header visible while you're hovering/interacting
 * with an open showcase-menu panel, instead of the header sliding
 * away underneath a panel that's still open.
 *
 * ADDED (blurred backdrop): a single shared .showcase-menu-backdrop
 * element is created once and appended to <body>, then toggled
 * alongside the panel via the same hover/focus handlers. Positioned
 * via CSS using the same --showcase-menu-bottom variable as the panel,
 * so it always starts directly under the nav bar/panel rather than
 * covering the header itself.
 *
 * FIXED (panel opening from theme-editor / programmatic focus): the
 * trigger's `focus` listener used to fire on ANY focus event,
 * including a synthetic focus() call — most notably the one the
 * Shopify theme editor applies to a block's root/trigger element when
 * that block is selected in the sidebar, purely to scroll/highlight
 * it for editing. That synthetic focus was indistinguishable from a
 * real keyboard tab-in, so simply selecting the showcase-menu block in
 * the editor was enough to open the panel and show the full-page
 * blurred backdrop with no actual hover or keyboard interaction. Real
 * keyboard users tabbing to the trigger get :focus-visible; a
 * programmatic focus() call generally does not (the browser's own
 * heuristic — see https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible).
 * Both the trigger's focus handler and the item's focusout handler now
 * check event.target.matches(':focus-visible') (feature-detected, so
 * browsers without support just fall back to the old behavior) before
 * treating the event as a real, intentional focus.
 *
 * Scroll-to-close: the header's sticky transition (assets/main-header.css,
 * .main-header--sticky-enabled.is-sticky) animates itself into place over
 * ~0.28s. Trying to keep an open panel visually glued to the header
 * through that animation isn't worth chasing — simplest fix is to just
 * close the panel as soon as scrolling starts, same as most mega-menus
 * already behave. (Auto-hide header + hover-pin above is the exception:
 * while a panel is genuinely open/hovered, the header no longer hides,
 * so there's usually nothing for this to need to chase in that mode.)
 *
 * This file's jobs:
 *   1. Measure + publish --showcase-menu-bottom (on load, on
 *      hover/focus of a trigger, right before a panel opens, and on
 *      resize/nav-bar-resize) so the panel is always positioned
 *      against the nav bar's current bottom edge.
 *   2. Track open state on hover/focus so scroll-close, escape, and
 *      click-outside all function on desktop, not just touch.
 *   3. Pin the header (main-header--menu-panel-open) while a panel is
 *      open, and show/hide the shared blurred backdrop.
 *   4. Escape close: closes the open panel and returns focus to its
 *      trigger.
 *   5. Click-outside close.
 *   6. Scroll close: closes the open panel as soon as the page scrolls.
 *   7. Touch support: first tap opens instead of navigating.
 */
(function () {
  'use strict';

  var items = document.querySelectorAll('[data-showcase-menu]');
  if (!items.length) return;

  var navBar = document.getElementById('main-header-menu-bar');
  var header = document.getElementById('main-header');
  var root = document.documentElement;
  var openItem = null;
  var rafId = null;

  var PIN_CLASS = 'main-header--menu-panel-open';

  // Feature-detect :focus-visible support once. If the browser doesn't
  // support it, isFocusVisible() below just returns true always,
  // preserving the old (pre-fix) behavior rather than breaking focus
  // handling entirely on older browsers.
  var supportsFocusVisible = true;
  try {
    document.querySelector(':focus-visible');
  } catch (e) {
    supportsFocusVisible = false;
  }

  function isFocusVisible(target) {
    if (!supportsFocusVisible || !target || typeof target.matches !== 'function') return true;
    try {
      return target.matches(':focus-visible');
    } catch (e) {
      return true;
    }
  }

  // Shared backdrop element — one for the whole menu bar, reused by
  // every showcase-menu item (and safe to share with mega-menu.js too,
  // if that file is updated to target the same element/class, since
  // only one panel can realistically be open at a time).
  var backdrop = document.querySelector('.showcase-menu-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'showcase-menu-backdrop';
    document.body.appendChild(backdrop);
  }

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

  function clearScrollLock(item) {
    var panel = getPanel(item);
    if (panel) panel.classList.remove('is-scroll-locked');
  }

  function pinHeaderAndShowBackdrop() {
    if (header) header.classList.add(PIN_CLASS);
    backdrop.classList.add('is-open');
  }

  function unpinHeaderAndHideBackdrop() {
    if (header) header.classList.remove(PIN_CLASS);
    backdrop.classList.remove('is-open');
  }

  function openMenu(item) {
    clearScrollLock(item); // a fresh open always cancels any prior lock

    if (openItem === item) return;
    if (openItem) closeMenu(openItem);

    updateBottomVar(); // measure fresh at the moment the panel opens

    var panel = getPanel(item);
    var trigger = getTrigger(item);
    panel.classList.add('is-open');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    openItem = item;
    pinHeaderAndShowBackdrop();
  }

  function closeMenu(item) {
    var panel = getPanel(item);
    var trigger = getTrigger(item);
    if (panel) panel.classList.remove('is-open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (openItem === item) {
      openItem = null;
      unpinHeaderAndHideBackdrop();
    }
  }

  // Scroll-close needs to override CSS's :hover/:focus-within rules,
  // not just remove .is-open — otherwise a panel stays visually open
  // through a scroll as long as the cursor never actually leaves the
  // menu item (true for trackpad/wheel scrolling, since the mouse
  // doesn't move). is-scroll-locked (!important in CSS) forces it
  // closed regardless of hover state. It's only cleared by a genuine
  // fresh interaction — mouseleave+re-enter or a trigger regaining
  // focus — never just because scrolling happened to stop, so the
  // panel can't silently reopen mid-scroll while still hovered.
  function scrollCloseMenu(item) {
    var panel = getPanel(item);
    var trigger = getTrigger(item);
    if (panel) {
      panel.classList.remove('is-open');
      panel.classList.add('is-scroll-locked');
    }
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (openItem === item) {
      openItem = null;
      unpinHeaderAndHideBackdrop();
    }
  }

  var isHovered = false;

  items.forEach(function (item) {
    var trigger = getTrigger(item);
    var panel = getPanel(item);
    if (!trigger || !panel) return;

    item.addEventListener('mouseenter', function () {
      clearScrollLock(item);
      updateBottomVar();
      // FIXED: previously nothing set openItem for a mouse hover, since
      // the panel's actual visual open state on desktop is driven by
      // CSS :hover, not by openMenu(). That left scroll-close, escape,
      // and click-outside all silently doing nothing on desktop.
      openItem = item;
      isHovered = true;
      pinHeaderAndShowBackdrop();
    });

    item.addEventListener('mouseleave', function () {
      clearScrollLock(item);
      isHovered = false;
      if (openItem === item) {
        openItem = null;
        unpinHeaderAndHideBackdrop();
      }
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

    // FIXED: only treat this as a real focus if it's keyboard-driven
    // (:focus-visible). A programmatic focus() call — e.g. the Shopify
    // theme editor focusing this trigger when its block is selected in
    // the sidebar — does not count, so selecting the block no longer
    // opens the panel/backdrop on its own.
    trigger.addEventListener('focus', function (event) {
      if (!isFocusVisible(event.target)) return;
      clearScrollLock(item);
      updateBottomVar();
      openItem = item;
      isHovered = true;
      pinHeaderAndShowBackdrop();
    });

    // Keyboard users tabbing through the panel's links need the same
    // "did focus actually leave this item" check mouseleave gets —
    // otherwise tabbing from the trigger into the panel's own links
    // would incorrectly unpin/close immediately.
    item.addEventListener('focusout', function (event) {
      if (!item.contains(event.relatedTarget)) {
        isHovered = false;
        if (openItem === item) {
          openItem = null;
          unpinHeaderAndHideBackdrop();
        }
      }
    });
  });

  document.addEventListener('click', function (event) {
    if (openItem && !openItem.contains(event.target)) {
      closeMenu(openItem);
    }
  });

  // Clicking the backdrop itself should also close whatever's open —
  // matches the reference behavior (Back Market etc.) where clicking
  // outside the panel, including on the dimmed/blurred area, dismisses it.
  backdrop.addEventListener('click', function () {
    if (openItem) closeMenu(openItem);
  });

  // Close on scroll — but ONLY if the panel isn't currently being
  // hovered/focused. openItem gets set the instant a real hover/focus
  // happens and cleared the instant it ends, so "openItem is set" and
  // "the user is genuinely interacting with it right now" are the same
  // condition. That means the old unconditional
  // `if (openItem) scrollCloseMenu(openItem)` was closing the panel on
  // the very first scroll tick even while the mouse never left it —
  // directly fighting the "stay open / keep header pinned while
  // hovering" behavior added above (a trackpad/wheel scroll doesn't
  // move the mouse, so mouseleave never fires, but this listener would
  // still slam the panel shut).
  //
  // isHovered tracks real pointer/focus presence separately from
  // openItem's open/closed bookkeeping, so scroll-close only fires for
  // the case it actually exists to handle: a stale/leftover open state
  // with no live hover or focus behind it (e.g. touch-opened panels,
  // or edge cases where focus moved outside the tracked handlers).
  window.addEventListener('scroll', function () {
    if (openItem && !isHovered) scrollCloseMenu(openItem);
  }, { passive: true });

  window.addEventListener('resize', scheduleUpdate);

  if (navBar && 'ResizeObserver' in window) {
    new ResizeObserver(scheduleUpdate).observe(navBar);
  }

  // Set an initial value on load so the var is never unset before the
  // first hover/focus/open.
  updateBottomVar();
})();