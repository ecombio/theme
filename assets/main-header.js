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