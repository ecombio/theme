(function () {
'use strict';

const header = document.getElementById('main-header');
const toolbar = document.querySelector('.collection-toolbar');
const root = document.documentElement;

if (!header) return;

// ── Header-bottom measurement ──────────────────────────────────────
// Runs regardless of whether sticky mode is enabled. Other components
// (showcase-menu.js, mega-menu.js) fall back to this only as a last
// resort now — they measure their own nav bar directly — but it's
// kept here too since main-header--is-sticky affects this value and
// this is still the most accurate source when sticky IS enabled.
const setHeaderBottomVar = () => {
  if (header.classList.contains('is-sticky')) {
    root.style.setProperty('--main-header-bottom', '0px');
  } else {
    root.style.setProperty('--main-header-bottom', header.getBoundingClientRect().bottom + 'px');
  }
};

setHeaderBottomVar();
window.addEventListener('resize', setHeaderBottomVar);
window.addEventListener('scroll', setHeaderBottomVar, { passive: true });

if ('ResizeObserver' in window) {
  new ResizeObserver(setHeaderBottomVar).observe(header);
}

// ── Nav-panel-open tracking ─────────────────────────────────────────
// showcase-menu.js (and mega-menu.js, if it adopts the same contract)
// dispatch these on document whenever a dropdown panel opens/closes,
// for any reason — hover, click, Escape, click-outside, or scroll.
// While a panel is open, autohide is paused so the header can't slide
// away out from under an open dropdown; if the header happened to
// already be hidden when a panel opens, it's brought back immediately.
let navPanelOpen = false;

document.addEventListener('showcase-menu:open', () => {
  navPanelOpen = true;
  header.classList.remove('is-hidden');
});

document.addEventListener('showcase-menu:close', () => {
  navPanelOpen = false;
});

// ── Sticky / autohide behavior ──────────────────────────────────────
if (!header.classList.contains('main-header--sticky-enabled')) return;

const STICKY_THRESHOLD = 60;
const AUTOHIDE_DELTA = 10;
const isAutohide = header.classList.contains('main-header--sticky-autohide');

let scrollAnchorY = window.scrollY;
let stickyRafId = null;
let resizeTimer = null;

const setHeaderHeightVar = () => {
  root.style.setProperty('--sticky-header-height', header.offsetHeight + 'px');
};

const setToolbarHeightVar = () => {
  if (!toolbar) return;
  const rect = toolbar.getBoundingClientRect();
  const marginBottom = parseFloat(getComputedStyle(toolbar).marginBottom) || 0;
  root.style.setProperty('--sticky-toolbar-height', (rect.height + marginBottom) + 'px');
};

const handleResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    setHeaderHeightVar();
    setToolbarHeightVar();
    setHeaderBottomVar();
  }, 80);
};

const handleStickyScroll = () => {
  const currentScrollY = window.scrollY;
  const wasSticky = header.classList.contains('is-sticky');

  if (currentScrollY > STICKY_THRESHOLD) {
    header.classList.add('is-sticky', 'is-scrolled');

    if (isAutohide && !navPanelOpen) {
      if (!wasSticky) {
        scrollAnchorY = currentScrollY;
      } else {
        const delta = currentScrollY - scrollAnchorY;
        if (delta > AUTOHIDE_DELTA) {
          header.classList.add('is-hidden');
          scrollAnchorY = currentScrollY;
        } else if (delta < -AUTOHIDE_DELTA) {
          header.classList.remove('is-hidden');
          scrollAnchorY = currentScrollY;
        }
      }
    } else if (isAutohide && navPanelOpen) {
      // Keep the anchor current so that once the panel closes,
      // autohide resumes based on fresh scroll movement instead of
      // an instant, stale delta accumulated while it was paused.
      scrollAnchorY = currentScrollY;
    }
  } else {
    header.classList.remove('is-sticky', 'is-scrolled', 'is-hidden');
    scrollAnchorY = currentScrollY;
    header.dispatchEvent(new CustomEvent('main-header:unstick'));
  }
};

const scheduleStickyUpdate = () => {
  if (stickyRafId !== null) return;
  stickyRafId = requestAnimationFrame(() => {
    stickyRafId = null;
    handleStickyScroll();
  });
};

// Init
setHeaderHeightVar();
setToolbarHeightVar();

window.addEventListener('scroll', scheduleStickyUpdate, { passive: true });
window.addEventListener('resize', handleResize);
handleStickyScroll();

if ('ResizeObserver' in window) {
  const headerRO = new ResizeObserver(() => {
    setHeaderHeightVar();
  });
  headerRO.observe(header);

  if (toolbar) {
    const toolbarRO = new ResizeObserver(setToolbarHeightVar);
    toolbarRO.observe(toolbar);
  }
}
})();