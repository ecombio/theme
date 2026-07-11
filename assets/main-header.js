(function () {
  'use strict';

  const header = document.getElementById('main-header');
  const toolbar = document.querySelector('.collection-toolbar');

  if (!header || !header.classList.contains('main-header--sticky-enabled')) return;

  const STICKY_THRESHOLD = 60;
  const AUTOHIDE_DELTA = 10;
  const isAutohide = header.classList.contains('main-header--sticky-autohide');

  // when a showcase-menu/mega-menu panel is open (hovered or
  // focused), showcase-menu.js adds this class to <header>. While it's
  // present, autohide must not slide the header away — otherwise the
  // panel (position: fixed, positioned against the header's bottom
  // edge) ends up floating over content with no header above it, or
  // gets visually reparented to the top of the viewport when the
  // header's translateY transform creates a new fixed-position
  // containing block. See handleStickyScroll below.
  const PIN_CLASS = 'main-header--menu-panel-open';

  const root = document.documentElement;
  let scrollAnchorY = window.scrollY;
  let bottomRafId = null;
  let stickyRafId = null;
  let resizeTimer = null;

  // Grace window after the header first becomes sticky. A fast scroll
  // flick can carry the page more than AUTOHIDE_DELTA px between two
  // rAF ticks, so without this the header can go sticky on one frame
  // and get is-hidden slapped on the very next frame — reads as "it
  // collapses immediately." Block autohide for a short window right
  // after the sticky transition so it gets a moment to show.
  const STICKY_GRACE_MS = 250;
  let stickyGraceUntil = 0;

  // This used to always read header.offsetHeight, which is a pure
  // layout measurement — it never changes when the autohide effect
  // slides the header away, because that effect works via
  // `transform: translateY(-100%)`, and transforms never affect
  // layout/box size. That meant --sticky-header-height stayed pinned
  // at the header's full height even while the header was completely
  // off-screen, so anything positioned with `top: var(--sticky-header-
  // height)` (e.g. .collection-toolbar) kept reserving a gap for a
  // header that wasn't visually there anymore — and only "snapped"
  // into the correct position later, whenever a resize/ResizeObserver
  // tick happened to fire.
  //
  // Now explicitly collapses to 0 whenever the header is hidden via
  // autohide, and is called from every place that toggles .is-hidden
  // (see handleStickyScroll below) instead of only on resize/
  // ResizeObserver, which never fire for a transform-only change.
  const setHeaderHeightVar = () => {
    const isHidden = isAutohide && header.classList.contains('is-hidden');
    const height = isHidden ? 0 : header.offsetHeight;
    root.style.setProperty('--sticky-header-height', height + 'px');
  };

  const setToolbarHeightVar = () => {
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    const marginBottom = parseFloat(getComputedStyle(toolbar).marginBottom) || 0;
    root.style.setProperty('--sticky-toolbar-height', (rect.height + marginBottom) + 'px');
  };

  const setHeaderBottomVar = () => {
    if (header.classList.contains('is-sticky')) {
      root.style.setProperty('--main-header-bottom', '0px');
    } else {
      root.style.setProperty('--main-header-bottom', header.getBoundingClientRect().bottom + 'px');
    }
  };

  const scheduleHeaderBottomUpdate = () => {
    if (bottomRafId !== null) return;
    bottomRafId = requestAnimationFrame(() => {
      bottomRafId = null;
      setHeaderBottomVar();
    });
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
    setHeaderBottomVar();

    const currentScrollY = window.scrollY;
    const wasSticky = header.classList.contains('is-sticky');

    if (currentScrollY > STICKY_THRESHOLD) {
      header.classList.add('is-sticky', 'is-scrolled');

      if (isAutohide) {
        // while a menu panel is open, keep the header pinned visible
        // and don't advance the scroll anchor — so the moment the
        // panel closes, autohide resumes cleanly from the current
        // scroll position instead of instantly registering a huge
        // "delta" and immediately hiding the header.
        if (header.classList.contains(PIN_CLASS)) {
          header.classList.remove('is-hidden');
          scrollAnchorY = currentScrollY;
          setHeaderHeightVar();
        } else if (!wasSticky) {
          // Just became sticky this frame — start the grace window
          // and don't evaluate a delta yet.
          scrollAnchorY = currentScrollY;
          stickyGraceUntil = Date.now() + STICKY_GRACE_MS;
          setHeaderHeightVar();
        } else if (Date.now() < stickyGraceUntil) {
          // Still inside the grace window — keep the anchor tracking
          // current scroll so no backlog of delta builds up, but
          // don't hide, no matter how fast the scroll is.
          scrollAnchorY = currentScrollY;
        } else {
          const delta = currentScrollY - scrollAnchorY;
          if (delta > AUTOHIDE_DELTA) {
            header.classList.add('is-hidden');
            scrollAnchorY = currentScrollY;
            setHeaderHeightVar();
          } else if (delta < -AUTOHIDE_DELTA) {
            header.classList.remove('is-hidden');
            scrollAnchorY = currentScrollY;
            setHeaderHeightVar();
          }
        }
      }
    } else {
      header.classList.remove('is-sticky', 'is-scrolled', 'is-hidden');
      scrollAnchorY = currentScrollY;
      setHeaderHeightVar();
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
  setHeaderBottomVar();

  window.addEventListener('scroll', scheduleStickyUpdate, { passive: true });
  window.addEventListener('resize', handleResize);
  handleStickyScroll();

  if ('ResizeObserver' in window) {
    const headerRO = new ResizeObserver(() => {
      setHeaderHeightVar();
      scheduleHeaderBottomUpdate();
    });
    headerRO.observe(header);

    if (toolbar) {
      const toolbarRO = new ResizeObserver(setToolbarHeightVar);
      toolbarRO.observe(toolbar);
    }
  }
})();