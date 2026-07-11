(function () {
  'use strict';

  var header = document.getElementById('main-header');
  if (!header) return;

  if (!header.classList.contains('main-header--sticky-enabled')) return;

  var THRESHOLD = 8;       // min px of scroll movement before reacting
  var SHOW_ZONE = 150;     // px of scroll from top where header always stays visible
  var lastY = window.scrollY;
  var ticking = false;
  var menuOpen = false;

  var menuBar = document.getElementById('main-header-menu-bar');
  if (menuBar) {
    menuBar.addEventListener('mouseenter', function (e) {
      if (e.target.closest && e.target.closest('.menu-bar__item')) menuOpen = true;
    }, true);
    menuBar.addEventListener('mouseleave', function (e) {
      if (e.target.closest && e.target.closest('.menu-bar__item')) menuOpen = false;
    }, true);
    menuBar.addEventListener('focusin', function () { menuOpen = true; });
    menuBar.addEventListener('focusout', function () {
      // slight delay so focus moving between menu children doesn't false-trigger
      window.setTimeout(function () {
        if (!menuBar.contains(document.activeElement)) menuOpen = false;
      }, 0);
    });
  }

  var onScroll = function () {
    var currentY = window.scrollY;
    var delta = currentY - lastY;

    // Never hide while a dropdown/mega-menu is open — hiding the header
    // out from under an open menu is what was corrupting the layout.
    if (menuOpen) {
      header.classList.remove('main-header--autohide-hidden');
      lastY = currentY;
      ticking = false;
      return;
    }

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