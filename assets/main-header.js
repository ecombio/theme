(function () {
  'use strict';

  var header = document.querySelector('[data-sticky-fixed="true"]');
  if (!header) return;

  var spacer = document.getElementById('main-header-sticky-spacer');

  var sync = function () {
    var full = header.offsetHeight;

    var hidden = header.classList.contains('main-header--autohide-hidden');
    var offset = hidden ? 0 : full;

    document.documentElement.style.setProperty('--main-header-bottom', offset + 'px');
    if (spacer) spacer.style.height = full + 'px';
  };

  sync();
  window.addEventListener('resize', sync);

  if ('ResizeObserver' in window) {
    new ResizeObserver(sync).observe(header);
  }

  window.__mainHeaderSync = sync;
})();

(function () {
  'use strict';

  var header = document.querySelector('[data-sticky-fixed="true"]');
  if (!header || header.dataset.autohide !== 'true') return;

  var THRESHOLD = 8;
  var REVEAL_ZONE = 80;

  var lastY = window.scrollY;
  var ticking = false;
  var isPaused = false;

  var syncBottomVar = function () {
    if (window.__mainHeaderSync) window.__mainHeaderSync();
  };

  header.addEventListener('mouseenter', function () { isPaused = true; });
  header.addEventListener('mouseleave', function () { isPaused = false; });

  header.addEventListener('focusin', function () { isPaused = true; });
  header.addEventListener('focusout', function () { isPaused = false; });

  /*
   * The predictive search dropdown (header-search.js) can open or close
   * without a matching focusin/focusout on the header — e.g. it renders
   * new panel content on every keystroke, or gets dismissed via Escape
   * or an outside click that never focused anything inside <header> in
   * the first place. Those don't naturally set/clear isPaused above, so
   * header-search.js dispatches these two events on the document to
   * cover that gap explicitly. While the panel is open we force the
   * header visible and pause autohide, so the dropdown never ends up
   * anchored to a header that has since scrolled away underneath it.
   */
  document.addEventListener('header-search:open', function () {
    isPaused = true;
    if (header.classList.contains('main-header--autohide-hidden')) {
      header.classList.remove('main-header--autohide-hidden');
      syncBottomVar();
    }
  });
  document.addEventListener('header-search:close', function () {
    isPaused = false;
  });

  header.addEventListener('transitionend', function (e) {
    if (e.propertyName === 'transform') syncBottomVar();
  });

  var onScroll = function () {
    var currentY = window.scrollY;
    var delta = currentY - lastY;

    if (currentY <= REVEAL_ZONE) {
      if (header.classList.contains('main-header--autohide-hidden')) {
        header.classList.remove('main-header--autohide-hidden');
        syncBottomVar();
      }
      lastY = currentY;
    } else if (Math.abs(delta) > THRESHOLD) {
      if (delta > 0 && !isPaused) {
        if (!header.classList.contains('main-header--autohide-hidden')) {
          header.classList.add('main-header--autohide-hidden');
          syncBottomVar();
        }
      } else if (delta < 0) {
        if (header.classList.contains('main-header--autohide-hidden')) {
          header.classList.remove('main-header--autohide-hidden');
          syncBottomVar();
        }
      }
      lastY = currentY;
    }

    ticking = false;
  };

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
})();
