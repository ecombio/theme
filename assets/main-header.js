(function () {
  'use strict';

  const header = document.getElementById('main-header');
  const toolbar = document.querySelector('.collection-toolbar');

  if (!header || !header.classList.contains('main-header--sticky-enabled')) return;

  const STICKY_THRESHOLD = 60;
  const AUTOHIDE_DELTA = 10;
  const isAutohide = header.classList.contains('main-header--sticky-autohide');

  // ADDED: when a showcase-menu/mega-menu panel is open (hovered or
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

  const setHeaderHeightVar = () => {
    root.style.setProperty('--sticky-header-height', header.offsetHeight + 'px');
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
        // ADDED: while a menu panel is open, keep the header pinned
        // visible and don't advance the scroll anchor — so the moment
        // the panel closes, autohide resumes cleanly from the current
        // scroll position instead of instantly registering a huge
        // "delta" and immediately hiding the header.
        if (header.classList.contains(PIN_CLASS)) {
          header.classList.remove('is-hidden');
          scrollAnchorY = currentScrollY;
        } else if (!wasSticky) {
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