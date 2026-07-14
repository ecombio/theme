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

  // Recomputed on resize so it doesn't go stale if the header's
  // height changes (announcement bar collapses, breakpoint shift,
  // web font swap causing reflow, etc).
  let revealZone = header.offsetHeight;
  window.addEventListener(
    'resize',
    () => {
      revealZone = header.offsetHeight;
    },
    { passive: true }
  );

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