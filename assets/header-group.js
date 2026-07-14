/* header-group.js
   Hide-on-scroll-down / show-on-scroll-up behavior for the fixed
   header, with a hover/focus lock so the header stays visible while
   a user is interacting with it (mouse or keyboard).

   Note: previously there were two separate scroll listeners doing
   this (one without the lock, one with it) attached to the same
   element — they raced against each other and could cause the
   header to flicker mid-hover. Consolidated into one here. */
(function () {
  const header = document.getElementById('header-group-wrapper');
  if (!header) return;

  let lastScrollY = window.scrollY;
  let ticking = false;
  let isLocked = false; // true while hovering/focusing header
  const SCROLL_THRESHOLD = 10; // ignore tiny jitters

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

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(syncHeaderHeightVar);
    resizeObserver.observe(header);
  } else {
    // Fallback for browsers without ResizeObserver: at least catch
    // viewport-driven changes (breakpoint shifts, orientation change).
    window.addEventListener('resize', syncHeaderHeightVar, { passive: true });
  }

  function onScroll() {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;

    if (isLocked) {
      // While locked, always keep it visible and just track position
      header.classList.remove('header--hidden');
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    // Always show header near the top of the page
    if (currentScrollY <= revealZone) {
      header.classList.remove('header--hidden');
    }
    // Scrolling down past threshold -> hide
    else if (delta > SCROLL_THRESHOLD) {
      header.classList.add('header--hidden');
    }
    // Scrolling up past threshold -> show
    else if (delta < -SCROLL_THRESHOLD) {
      header.classList.remove('header--hidden');
    }

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
    header.classList.remove('header--hidden');
  });

  header.addEventListener('mouseleave', () => {
    isLocked = false;
    lastScrollY = window.scrollY; // reset baseline so it doesn't jump-hide immediately
  });

  // --- Focus lock (keyboard users tabbing through nav/menu links) ---
  header.addEventListener('focusin', () => {
    isLocked = true;
    header.classList.remove('header--hidden');
  });

  header.addEventListener('focusout', (e) => {
    // Only unlock if focus actually left the header, not just moved between children
    if (!header.contains(e.relatedTarget)) {
      isLocked = false;
      lastScrollY = window.scrollY;
    }
  });
})();