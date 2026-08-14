(function () {
  'use strict';

  var menuBar = document.getElementById('main-header-menu-bar');
  if (!menuBar) return;

  var BUFFER = 1;

  var getScrollEl = function () {
    var container = menuBar.querySelector('.menu-bar__container');
    if (container && container.scrollWidth > container.clientWidth) return container;
    if (menuBar.scrollWidth > menuBar.clientWidth) return menuBar;
    return container || menuBar;
  };

  var update = function () {
    var el = getScrollEl();
    var maxScroll = el.scrollWidth - el.clientWidth;

    if (maxScroll <= BUFFER) {
      menuBar.classList.remove('has-scroll-left', 'has-scroll-right');
      return;
    }

    menuBar.classList.toggle('has-scroll-left', el.scrollLeft > BUFFER);
    menuBar.classList.toggle('has-scroll-right', el.scrollLeft < maxScroll - BUFFER);
  };

  var scrollTarget = menuBar.querySelector('.menu-bar__container') || menuBar;

  update();
  scrollTarget.addEventListener('scroll', update, { passive: true });
  menuBar.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);

  if ('ResizeObserver' in window) {
    new ResizeObserver(update).observe(menuBar);
  }
})();