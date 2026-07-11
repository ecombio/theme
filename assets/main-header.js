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

  var header = document.getElementById('main-header');
  if (!header || !header.classList.contains('main-header--sticky-enabled')) return;

  // CSS `position: sticky` silently no-ops if any ancestor has
  // overflow/transform/perspective set, which is common in theme
  // section wrappers. Doing this in JS avoids that class of bug.

  // Sentinel sits immediately before the header. Once it scrolls
  // out of view above the viewport, the header has reached the top
  // and should switch to fixed positioning.
  var sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:relative;height:1px;margin-top:-1px;pointer-events:none;';
  header.parentNode.insertBefore(sentinel, header);

  // Spacer keeps the layout from jumping when the header is pulled
  // out of flow via position:fixed.
  var spacer = document.createElement('div');
  spacer.className = 'main-header__sticky-spacer';
  spacer.setAttribute('aria-hidden', 'true');

  var isStuck = false;

  var stick = function () {
    if (isStuck) return;
    isStuck = true;
    spacer.style.height = header.offsetHeight + 'px';
    header.parentNode.insertBefore(spacer, header);
    header.classList.add('main-header--is-stuck');
  };

  var unstick = function () {
    if (!isStuck) return;
    isStuck = false;
    header.classList.remove('main-header--is-stuck');
    if (spacer.parentNode) spacer.parentNode.removeChild(spacer);
  };

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          unstick();
        } else if (entry.boundingClientRect.top < 0) {
          stick();
        }
      });
    }, { threshold: 0 });

    observer.observe(sentinel);
  } else {
    // Fallback for browsers without IntersectionObserver.
    var headerOffsetTop = header.getBoundingClientRect().top + window.pageYOffset;
    var handleScroll = function () {
      if (window.pageYOffset > headerOffsetTop) {
        stick();
      } else {
        unstick();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  window.addEventListener('resize', function () {
    if (!isStuck) return;
    // Re-measure in case responsive layout changed the header height.
    header.classList.remove('main-header--is-stuck');
    spacer.style.height = header.offsetHeight + 'px';
    header.classList.add('main-header--is-stuck');
  });
})();