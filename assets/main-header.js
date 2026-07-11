(function () {
  'use strict';

  const header = document.getElementById('main-header');
  const toolbar = document.querySelector('.collection-toolbar');

  if (!header || !header.classList.contains('main-header--sticky-enabled')) return;

  // Measured from the header's own rendered height instead of a fixed
  // number. A hardcoded threshold (e.g. 60px) can be much smaller than
  // the header's real height (utility bar + main row + nav row), which
  // causes the header to snap to position:fixed while it's still
  // partway through scrolling out of view in normal document flow —
  // visually reading as a second header teleporting in. Measuring the
  // real height means sticky mode only engages once the header would
  // have scrolled fully off-screen anyway, so there's nothing to jump
  // from and the transition is seamless.
  let stickyThreshold = header.offsetHeight;
  const AUTOHIDE_DELTA = 10;
  const STICKY_GRACE_MS = 250;
  const PIN_CLASS = 'main-header--menu-panel-open';

  const root = document.documentElement;
  let scrollAnchorY = window.scrollY;
  let stickyGraceUntil = 0;
  let bottomRafId = null;
  let stickyRafId = null;
  let resizeTimer = null;

  const spacer = document.createElement('div');
  spacer.className = 'main-header-sticky__spacer';
  header.insertAdjacentElement('afterend', spacer);

  const setHeaderHeightVar = () => {
    const isHidden = header.classList.contains('is-hidden');
    const height = isHidden ? 0 : header.offsetHeight;
    root.style.setProperty('--sticky-header-height', height + 'px');

    if (header.classList.contains('is-sticky')) {
      spacer.style.height = header.offsetHeight + 'px';
      spacer.classList.add('is-active');
    } else {
      spacer.classList.remove('is-active');
    }
  };

  const setToolbarHeightVar = () => {
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    const marginBottom = parseFloat(getComputedStyle(toolbar).marginBottom) || 0;
    root.style.setProperty('--sticky-toolbar-height', (rect.height + marginBottom) + 'px');
  };

  const setHeaderBottomVar = () => {
    root.style.setProperty(
      '--main-header-bottom',
      header.classList.contains('is-sticky') ? '0px' : header.getBoundingClientRect().bottom + 'px'
    );
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
      if (!header.classList.contains('is-sticky')) {
        stickyThreshold = header.offsetHeight;
      }
      setHeaderHeightVar();
      setToolbarHeightVar();
      setHeaderBottomVar();
    }, 80);
  };

  const handleStickyScroll = () => {
    setHeaderBottomVar();

    const currentScrollY = window.scrollY;
    const wasSticky = header.classList.contains('is-sticky');

    if (currentScrollY > stickyThreshold) {
      header.classList.add('is-sticky', 'is-scrolled');
      setHeaderHeightVar();

      if (header.classList.contains(PIN_CLASS)) {
        header.classList.remove('is-hidden');
        scrollAnchorY = currentScrollY;
        setHeaderHeightVar();
      } else if (!wasSticky) {
        scrollAnchorY = currentScrollY;
        stickyGraceUntil = Date.now() + STICKY_GRACE_MS;
        setHeaderHeightVar();
      } else if (Date.now() < stickyGraceUntil) {
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
      new ResizeObserver(setToolbarHeightVar).observe(toolbar);
    }
  }
})();