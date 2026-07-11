(function () {
  'use strict';

  var nav = document.getElementById('main-header-menu-bar');
  if (!nav) return;

  var container = nav.querySelector('.menu-bar__container');
  if (!container) return;

  var THRESHOLD = 4;

  var updateFades = function () {
    var scrollLeft = container.scrollLeft;
    var maxScroll = container.scrollWidth - container.clientWidth;

    nav.classList.toggle('has-scroll-left', scrollLeft > THRESHOLD);
    nav.classList.toggle('has-scroll-right', scrollLeft < maxScroll - THRESHOLD);
  };

  updateFades();
  container.addEventListener('scroll', updateFades, { passive: true });
  window.addEventListener('resize', updateFades);

  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(updateFades);
    ro.observe(container);
  }
})();

(function () {
  'use strict';

  var header = document.querySelector('[data-sticky-fixed="true"]');
  if (!header || header.dataset.autohide !== 'true') return;

  var THRESHOLD = 8;    // px of scroll before we react — avoids jitter on tiny scrolls
  var REVEAL_ZONE = 80; // always show header within this many px of the top

  var lastY = window.scrollY;
  var ticking = false;

  var onScroll = function () {
    var currentY = window.scrollY;
    var delta = currentY - lastY;

    if (currentY <= REVEAL_ZONE) {
      header.classList.remove('main-header--autohide-hidden');
      lastY = currentY;
    } else if (Math.abs(delta) > THRESHOLD) {
      if (delta > 0) {
        // scrolling down
        header.classList.add('main-header--autohide-hidden');
      } else {
        // scrolling up
        header.classList.remove('main-header--autohide-hidden');
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