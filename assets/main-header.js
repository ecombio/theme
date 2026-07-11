(function () {
  'use strict';

  var header = document.getElementById('main-header');
  if (!header) return;

  if (!header.classList.contains('main-header--sticky-enabled')) return;

  var THRESHOLD = 8;       // min px of scroll movement before reacting
  var SHOW_ZONE = 150;     // px of scroll from top where header always stays visible
  var lastY = window.scrollY;
  var ticking = false;

  var onScroll = function () {
    var currentY = window.scrollY;
    var delta = currentY - lastY;

    // Always show header near the top of the page — this needs to be a
    // real buffer (not just the header's own height), otherwise a single
    // small scroll tick crosses it immediately and the header appears
    // to hide itself right away.
    if (currentY <= SHOW_ZONE) {
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