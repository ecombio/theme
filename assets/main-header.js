(function () {
  'use strict';

  var header = document.getElementById('main-header');
  if (!header) return;

  if (!header.classList.contains('main-header--sticky-enabled')) return;

  var THRESHOLD = 8;       // min px of scroll movement before reacting
  var lastY = window.scrollY;
  var ticking = false;

  var headerHeight = function () {
    return header.offsetHeight;
  };

  var onScroll = function () {
    var currentY = window.scrollY;
    var delta = currentY - lastY;

    // Always show header near the top of the page
    if (currentY <= headerHeight()) {
      header.classList.remove('main-header--autohide-hidden');
      lastY = currentY;
      ticking = false;
      return;
    }

    if (Math.abs(delta) < THRESHOLD) {
      ticking = false;
      return;
    }

    if (delta > 0) {
      // scrolling down
      header.classList.add('main-header--autohide-hidden');
    } else {
      // scrolling up
      header.classList.remove('main-header--autohide-hidden');
    }

    lastY = currentY;
    ticking = false;
  };

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
})();