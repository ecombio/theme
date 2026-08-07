/* header-group.js
   Hide-on-scroll-down / show-on-scroll-up behavior for the fixed
   header, with a hover/focus lock so the header stays visible while
   a user is interacting with it (mouse or keyboard).

   Note: previously there were two separate scroll listeners doing
   this (one without the lock, one with it) attached to the same
   element — they raced against each other and could cause the
   header to flicker mid-hover. Consolidated into one here.

   ADDED — transparent-over-hero header state.
   Only ever active when #main-header carries
   data-transparent-header="true" (set server-side in
   main-header.liquid from request.page_type == 'index', so it can
   never fire on non-homepage pages regardless of what happens here).
   When active:
     - #header-group-wrapper starts transparent (see header-group.css
       for the actual background/box-shadow/color overrides gated
       behind the .is-transparent class added below).
     - It flips solid as soon as the page scrolls even slightly past
       the very top (TRANSPARENT_THRESHOLD) — i.e. as soon as the
       header is in its "stuck" state rather than sitting at rest
       over the hero.
     - It also flips solid on hover/focus, reusing the same isLocked
       flag the hide-on-scroll behavior already tracks, so a user
       parked at the very top can still mouse over the nav and read
       it against a solid background before ever scrolling.
   On any other page this block still runs (cheap: one dataset read)
   but transparentEnabled is false, updateTransparency() no-ops
   immediately, and .is-transparent is never added — today's existing
   solid-header behavior is unchanged. */
(function () {
  const header = document.getElementById('header-group-wrapper');
  if (!header) return;

  let lastScrollY = window.scrollY;
  let ticking = false;
  let isLocked = false; // true while hovering/focusing header
  const SCROLL_THRESHOLD = 10; // ignore tiny jitters

  // ADDED — transparent-over-hero state.
  const mainHeaderEl = document.getElementById('main-header');
  const transparentEnabled = !!mainHeaderEl && mainHeaderEl.dataset.transparentHeader === 'true';
  const TRANSPARENT_THRESHOLD = 10; // px — "sticky" trigger point; flips solid almost as soon as the page moves at all
  let isTransparent = false;

  function updateTransparency() {
    if (!transparentEnabled) return;
    const shouldBeTransparent = !isLocked && window.scrollY <= TRANSPARENT_THRESHOLD;
    if (shouldBeTransparent === isTransparent) return;
    isTransparent = shouldBeTransparent;
    header.classList.toggle('is-transparent', shouldBeTransparent);
  }

  // Recomputed whenever the header's real height changes, so it
  // doesn't go stale if content changes (announcement bar dismissed,
  // breakpoint shift, web font swap causing reflow, etc).
  let revealZone = header.offsetHeight;

  // The header is position: fixed, so it's out of normal document
  // flow — anything that needs to know its height (the spacer, but
  // also anchor-link scroll offsets, sticky sidebars, etc.) should
  // read it from this single source of truth instead of guessing.
  // We publish it as a CSS custom property on :root rather than
  // setting the spacer's inline height directly, so any stylesheet
  // in the theme can consume it via var(--header-group-height).
  // header-group.css ships a static fallback value for first paint
  // and no-JS; this keeps it accurate afterward, including whenever
  // the header's content changes (e.g. the announcement bar's
  // dismiss button, promo copy wrapping to a second line, locale
  // switcher opening/closing).
  const root = document.documentElement;

  function syncHeaderHeightVar() {
    const height = header.offsetHeight;
    revealZone = height;
    root.style.setProperty('--header-group-height', height + 'px');
  }

  syncHeaderHeightVar();

  // ADDED — set the initial transparent/solid state before the first
  // scroll or hover event fires, so a homepage load that starts at
  // the top doesn't flash solid-white for a frame first.
  updateTransparency();

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(syncHeaderHeightVar);
    resizeObserver.observe(header);
  } else {
    // Fallback for browsers without ResizeObserver: at least catch
    // viewport-driven changes (breakpoint shifts, orientation change).
    window.addEventListener('resize', syncHeaderHeightVar, { passive: true });
  }

  // Single place that toggles the header's hidden state. Mirrors it
  // onto :root as a class (rather than only the header element) so
  // any other fixed/sticky element in the theme — the collection
  // toolbar, a sticky sidebar, etc. — can react to the header
  // disappearing without each one needing its own scroll listener.
  // e.g. `:root.header-group-hidden .my-sticky-el { top: 0; }`
  let isHidden = false;

  function setHeaderHidden(hidden) {
    if (hidden === isHidden) return;
    isHidden = hidden;
    header.classList.toggle('header--hidden', hidden);
    root.classList.toggle('header-group-hidden', hidden);
  }

  function onScroll() {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;

    if (isLocked) {
      // While locked, always keep it visible and just track position
      setHeaderHidden(false);
      updateTransparency();
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    // Always show header near the top of the page
    if (currentScrollY <= revealZone) {
      setHeaderHidden(false);
    }
    // Scrolling down past threshold -> hide
    else if (delta > SCROLL_THRESHOLD) {
      setHeaderHidden(true);
    }
    // Scrolling up past threshold -> show
    else if (delta < -SCROLL_THRESHOLD) {
      setHeaderHidden(false);
    }

    updateTransparency();

    lastScrollY = currentScrollY;
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    },
    { passive: true }
  );

  // --- Hover lock (mouse users) ---
  header.addEventListener('mouseenter', () => {
    isLocked = true;
    setHeaderHidden(false);
    updateTransparency();
  });

  header.addEventListener('mouseleave', () => {
    isLocked = false;
    lastScrollY = window.scrollY; // reset baseline so it doesn't jump-hide immediately
    updateTransparency();
  });

  // --- Focus lock (keyboard users tabbing through nav/menu links) ---
  header.addEventListener('focusin', () => {
    isLocked = true;
    setHeaderHidden(false);
    updateTransparency();
  });

  header.addEventListener('focusout', (e) => {
    // Only unlock if focus actually left the header, not just moved between children
    if (!header.contains(e.relatedTarget)) {
      isLocked = false;
      lastScrollY = window.scrollY;
      updateTransparency();
    }
  });
})();