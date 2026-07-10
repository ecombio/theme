/* This file owns sticky-scroll behavior only — snippet-specific scripts live in each snippet's own JS file. */
/**
 * Main Header Controller
 * File: assets/main-header.js
 * Loaded by: sections/main-header.liquid (defer)
 *
 * Responsibilities:
 *   1. Sticky scroll behavior (.is-sticky / .is-scrolled, CSS var sync)
 *      — merged in from assets/main-header-sticky.js
 *   1b. Auto-hide sticky variant: when the header has the
 *       .main-header--sticky-autohide modifier (set via the "Sticky
 *       header style" theme setting), this also tracks scroll direction
 *       once the header is sticky and toggles .is-hidden — hiding the
 *       header on scroll-down, revealing it on scroll-up. The CSS side
 *       (transform + transition) lives in main-header.css, in the
 *       "STICKY — AUTO-HIDE VARIANT" block. Standard sticky headers
 *       (no autohide modifier) never gain/lose .is-hidden, so this is
 *       fully inert for them.
 *   2. Keeps --main-header-bottom in sync: the header's live bottom
 *      edge in viewport coordinates (header.getBoundingClientRect().bottom).
 *      This is the ONE place that measurement happens. Any fixed-position
 *      dropdown panel that needs to sit flush under the header (showcase-menu,
 *      mega-menu, flyout-menu, etc.) should read `top: var(--main-header-bottom)`
 *      in its own CSS instead of each snippet's JS running its own
 *      scroll/resize/ResizeObserver trio to compute the same thing
 *      independently. Previously showcase-menu.js did exactly that in
 *      isolation — several snippets each measuring and writing their own
 *      inline `top` was how panels ended up visibly drifting out of sync
 *      with the header (each one only updating on its own triggers, so a
 *      header-height change picked up by one panel's listener wouldn't
 *      necessarily fire another's on the same frame).
 *
 *      NOTE: when the header is hidden via the auto-hide variant, its
 *      own bottom edge moves off-screen (goes negative) along with it,
 *      so --main-header-bottom naturally reflects that too — no extra
 *      handling needed here for that case.
 *
 *      NOTE: --sticky-header-height (below) is NOT the same value as
 *      --main-header-bottom, and isn't a substitute for it. Height is
 *      just the header's own offsetHeight; bottom also accounts for
 *      whatever is stacked above the header (e.g. an announcement bar)
 *      before the header goes fixed via .is-sticky. Once .is-sticky is
 *      active (position: fixed; top: 0), the two happen to be equal,
 *      but before that they can differ — bottom is the one dropdown
 *      panels actually want.
 *
 * Hamburger buttons and the mobile nav drawer (open/close/Escape/
 * outside-click, focus trap, body scroll lock, and the sticky
 * hamburger's own click-to-toggle-.menu-bar behavior) all moved to
 * assets/header-hamburger.js, loaded by snippets/header-hamburger.liquid.
 * This file no longer touches any hamburger/drawer elements directly.
 * The auto-hide variant intentionally has no hamburger/toggle button at
 * all (see main-header.css), so there's nothing for that file to do in
 * this mode either.
 *
 * Coordination with header-hamburger.js: when the scroll handler below
 * detects we've left sticky mode, it dispatches a `main-header:unstick`
 * CustomEvent on #main-header instead of resetting the sticky
 * hamburger/.menu-bar state itself. header-hamburger.js listens for that
 * event and resets its own state. Neither file needs to know the other's
 * internals beyond that one event name — see header-hamburger.js for the
 * listener.
 *
 * MERGE NOTE: this file used to carry its own lighter sticky-scroll
 * implementation (a bare `window.scrollY > 4` check toggling only
 * .is-scrolled). That's been replaced with main-header-sticky.js's
 * version below, since it's the more complete implementation — it also
 * owns .is-sticky and syncs --sticky-header-height /
 * --sticky-toolbar-height CSS custom properties via ResizeObserver. Only
 * one sticky module should exist now; if assets/main-header-sticky.js is
 * still being loaded as its own <script> tag anywhere, remove that tag —
 * otherwise you're back to two listeners fighting over .is-scrolled.
 *
 * PERF FIX (scroll handler now rAF-throttled): handleStickyScroll used
 * to run directly as the 'scroll' event listener, meaning it fired on
 * every native scroll event — during momentum/trackpad scrolling that
 * can be 50-100+ times per second, far more often than the browser
 * actually repaints. Each call toggled .is-hidden directly, which drives
 * a CSS `transition: transform` in main-header.css. Toggling that class
 * multiple times within a single animation frame kept interrupting and
 * restarting the transition before it could finish, which is what
 * produced the "stalls partway through, then suddenly snaps into place"
 * stutter on auto-hide. It also made the scroll-direction delta noisy,
 * since it was being computed between two raw, sub-pixel-apart scroll
 * events instead of a meaningful per-frame movement.
 *
 * Fixed the same way --main-header-bottom's measurement was already
 * throttled (see scheduleHeaderBottomUpdate below, which predates this
 * fix and was the correct pattern all along): the scroll listener now
 * only *schedules* work via requestAnimationFrame, coalescing any burst
 * of native scroll events down to at most one handleStickyScroll() call
 * per frame. That's also why setHeaderBottomVar() is called directly
 * inside handleStickyScroll now instead of going through its own nested
 * rAF wrapper — handleStickyScroll itself is already frame-throttled, so
 * a second layer of throttling on top just added a redundant frame of
 * lag. scheduleHeaderBottomUpdate() is kept around as-is for the
 * ResizeObserver callbacks further down, which fire outside the scroll
 * path and still need their own throttling independently.
 *
 * FLICKER FIX (anchor-based hysteresis instead of frame-to-frame delta):
 * the auto-hide direction check used to compare currentScrollY against
 * lastScrollY, and lastScrollY was overwritten on every single frame
 * regardless of whether anything happened. That meant two small opposite
 * scroll wiggles in a row (trackpad jitter, rubber-band bounce, a mouse
 * wheel's sub-pixel steps) were enough to re-trigger the toggle — a +6px
 * nudge would cross the dead zone and hide the header, then a -6px
 * wiggle right after would cross it back and show it again, restarting
 * the transition each time. That's the "flickers on small wiggles"
 * symptom.
 *
 * Fixed by turning the reference point into an anchor that only moves
 * when the header actually commits to hiding or showing — see
 * scrollAnchorY below. A wiggle that doesn't clear AUTOHIDE_DELTA no
 * longer resets anything, so it can't accumulate into a flip the way
 * repeated small deltas against a constantly-refreshed lastScrollY
 * could. The anchor is also reset the moment the header enters sticky
 * mode, so it doesn't judge direction against wherever the user
 * happened to be scrolling before crossing STICKY_THRESHOLD (which
 * could otherwise cause an instant hide-flash right as the header pins).
 *
 * Cart button/badge behaviour is NOT handled here — that logic lives
 * entirely in assets/header-cart.js, which is the correct, complete
 * implementation (real selectors, badge pop animation, drawer-open/close
 * aria sync). This file used to duplicate a broken version of that logic
 * (wrong element ID, wrong badge selector) — it's been removed rather
 * than merged in, since header-cart.js already covers it correctly.
 *
 * Search (predictive search, voice, category pill, recent searches) is
 * entirely handled by assets/header-search.js — this file does NOT touch
 * any .hs__* elements.
 */

(function () {
  'use strict';

  /* ── Element refs ─────────────────────────────────────────────────────── */
  var header  = document.getElementById('main-header');
  var toolbar = document.querySelector('.collection-toolbar');

  /* ─────────────────────────────────────────────────────────────────────
     STICKY SCROLL BEHAVIOR
     Only runs if sticky header is enabled via theme setting.
     ───────────────────────────────────────────────────────────────────── */
  if (!header || !header.classList.contains('main-header--sticky-enabled')) {
    return;
  }

  var STICKY_THRESHOLD = 60;

  /* Whether the "Sticky header style" theme setting is set to Auto-hide.
     Set once from the class main-header.liquid renders — no other JS
     needs to know or care about this beyond the block below. */
  var isAutohide = header.classList.contains('main-header--sticky-autohide');

  /* Minimum scroll distance (px) from the anchor point before we act on
     direction. Filters out sub-pixel jitter, momentum/rubber-band bounce
     at the top or bottom of the page, and trackpad noise, so the header
     doesn't flicker hidden/shown on a nearly-stationary scroll position.
     scrollAnchorY is NOT updated every frame — only when we actually
     commit to hiding or showing (see handleStickyScroll) — so small
     wiggles that stay inside this dead zone can't accumulate into a
     flip the way comparing against a constantly-refreshed value could. */
  var AUTOHIDE_DELTA = 8;
  var scrollAnchorY = window.scrollY;

  var root = document.documentElement;
  var bottomRafId = null;

  var setHeaderHeightVar = function () {
    root.style.setProperty('--sticky-header-height', header.offsetHeight + 'px');
  };

  var setToolbarHeightVar = function () {
    if (!toolbar) return;
    var rect = toolbar.getBoundingClientRect();
    var marginBottom = parseFloat(getComputedStyle(toolbar).marginBottom) || 0;
    root.style.setProperty('--sticky-toolbar-height', (rect.height + marginBottom) + 'px');
  };

  /* The one place --main-header-bottom gets written. Kept cheap (a single
     getBoundingClientRect + a single custom-property write). Called
     directly (not through the rAF scheduler below) from inside
     handleStickyScroll, since that function is now itself already
     rAF-throttled — see scheduleHeaderBottomUpdate's own doc comment
     for why it still exists separately for the ResizeObserver path. */
  var setHeaderBottomVar = function () {
    root.style.setProperty('--main-header-bottom', header.getBoundingClientRect().bottom + 'px');
  };

  /* rAF-throttled wrapper for triggers that can fire faster than the
     browser can paint. Used by the ResizeObserver callbacks further
     down, which fire independently of scroll and still need their own
     coalescing. The scroll path no longer routes through this — it has
     its own top-level rAF throttle now (see scheduleStickyUpdate),
     which already guarantees setHeaderBottomVar() runs at most once per
     frame during scroll, so wrapping it a second time there would only
     add a redundant frame of lag. */
  var scheduleHeaderBottomUpdate = function () {
    if (bottomRafId !== null) return;
    bottomRafId = window.requestAnimationFrame(function () {
      bottomRafId = null;
      setHeaderBottomVar();
    });
  };

  /* Debounce resize so we're not writing custom properties on every
     pixel of a drag-resize */
  var resizeTimer;
  var handleResize = function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      setHeaderHeightVar();
      setToolbarHeightVar();
      setHeaderBottomVar();
    }, 100);
  };

  var handleStickyScroll = function () {
    // Bottom edge can move on every scroll pixel pre-sticky (e.g. an
    // announcement bar above the header scrolling away), and can also
    // shift the moment .is-sticky toggles, so this runs regardless of
    // which branch below fires. Called directly since this whole
    // function is already rAF-throttled by scheduleStickyUpdate below.
    setHeaderBottomVar();

    var currentScrollY = window.scrollY;
    var wasSticky = header.classList.contains('is-sticky');

    if (currentScrollY > STICKY_THRESHOLD) {
      header.classList.add('is-sticky');
      header.classList.add('is-scrolled');

      /* Auto-hide direction tracking only runs once we're actually
         sticky — before that the header is still in normal flow and
         .is-hidden has no visual effect anyway (see main-header.css,
         which only translates it while .is-sticky is also present). */
      if (isAutohide) {
        if (!wasSticky) {
          /* Just crossed into sticky mode this frame — reset the anchor
             to right here instead of judging direction against wherever
             the user was scrolling before crossing STICKY_THRESHOLD.
             Without this, a fast scroll down that crosses the threshold
             could immediately register as a big delta and hide the
             header the instant it appears. */
          scrollAnchorY = currentScrollY;
        } else {
          var delta = currentScrollY - scrollAnchorY;
          if (delta > AUTOHIDE_DELTA) {
            header.classList.add('is-hidden');
            scrollAnchorY = currentScrollY;
          } else if (delta < -AUTOHIDE_DELTA) {
            header.classList.remove('is-hidden');
            scrollAnchorY = currentScrollY;
          }
          /* Deltas within the dead zone leave both .is-hidden and
             scrollAnchorY exactly as they were — a wiggle that doesn't
             clear the threshold can't nudge the anchor and therefore
             can't accumulate into a flip on the next frame either. */
        }
      }
    } else {
      header.classList.remove('is-sticky');
      header.classList.remove('is-scrolled');

      /* Reset hidden state whenever we drop out of sticky mode (e.g.
         scrolled back up to the very top), so the header doesn't come
         back already hidden the next time it re-enters sticky mode. */
      if (isAutohide) {
        header.classList.remove('is-hidden');
      }

      /* Reset the anchor too, so re-entering sticky mode later starts
         fresh rather than carrying over a stale reference point from
         this excursion out of sticky mode. */
      scrollAnchorY = currentScrollY;

      /* Let header-hamburger.js know we've left sticky mode, so it can
         reset its own hamburger/.menu-bar state. See file header
         comment above for why this is an event rather than a direct
         DOM reset. */
      header.dispatchEvent(new CustomEvent('main-header:unstick'));
    }
  };

  /* Coalesces any burst of native 'scroll' events down to at most one
     handleStickyScroll() call per animation frame. This is the actual
     fix for the auto-hide stutter: previously handleStickyScroll ran
     directly as the scroll listener (see PERF FIX note at the top of
     this file for the full explanation of why that caused interrupted
     mid-transition jank). */
  var stickyRafId = null;
  var scheduleStickyUpdate = function () {
    if (stickyRafId !== null) return;
    stickyRafId = window.requestAnimationFrame(function () {
      stickyRafId = null;
      handleStickyScroll();
    });
  };

  /* Initial measurement, before first paint of dependent consumers */
  setHeaderHeightVar();
  setToolbarHeightVar();
  setHeaderBottomVar();

  window.addEventListener('scroll', scheduleStickyUpdate, { passive: true });
  window.addEventListener('resize', handleResize);
  handleStickyScroll();

  /* ResizeObserver catches height changes resize alone won't — e.g. the
     menu bar expanding when the sticky hamburger is toggled open, the
     mobile search row toggling, or font/zoom-driven reflow. */
  if ('ResizeObserver' in window) {
    var headerRO = new ResizeObserver(function () {
      setHeaderHeightVar();
      scheduleHeaderBottomUpdate();
    });
    headerRO.observe(header);

    if (toolbar) {
      var toolbarRO = new ResizeObserver(setToolbarHeightVar);
      toolbarRO.observe(toolbar);
    }
  }

})();