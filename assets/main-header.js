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
  if (!header) return;

  var spacer = document.getElementById('main-header-sticky-spacer');

  var sync = function () {
    // Full header height — always reserved in the spacer regardless of
    // autohide state, so the page's normal-flow layout never changes
    // size on hide/show. Resizing the spacer here previously triggered
    // the browser's scroll-anchoring compensation, which fired its own
    // scroll events and fed back into the autohide handler in a loop.
    var full = header.offsetHeight;

    // Sticky-offset variable, consumed by things like collection-toolbar's
    // `top`, which don't affect document flow — safe to drop to 0 while
    // the header is off-screen so those elements close the gap.
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

  // Exposed so the autohide script (below) can re-run this after it
  // toggles main-header--autohide-hidden, keeping --main-header-bottom
  // and the spacer in sync with whether the header is actually visible.
  window.__mainHeaderSync = sync;
})();

(function () {
  'use strict';

  var header = document.querySelector('[data-sticky-fixed="true"]');
  if (!header || header.dataset.autohide !== 'true') return;

  var THRESHOLD = 8;    // px of scroll before we react — avoids jitter on tiny scrolls
  var REVEAL_ZONE = 80; // always show header within this many px of the top

  var lastY = window.scrollY;
  var ticking = false;
  var isPaused = false; // true while the header (incl. menu items/dropdowns) is hovered or focused

  var syncBottomVar = function () {
    if (window.__mainHeaderSync) window.__mainHeaderSync();
  };

  // Hover: pointer over the header itself, a nav item, or an open mega-menu/showcase-menu panel
  // (these render as descendants of <header>, so one listener covers all of it).
  header.addEventListener('mouseenter', function () { isPaused = true; });
  header.addEventListener('mouseleave', function () { isPaused = false; });

  // Keyboard: tabbing through menu links/inputs should pause it too, not just mouse hover.
  header.addEventListener('focusin', function () { isPaused = true; });
  header.addEventListener('focusout', function () { isPaused = false; });

  // Once the slide transition finishes, re-measure so --main-header-bottom
  // and the spacer reflect whatever the header's final state actually is
  // (0 when hidden, full height when revealed) instead of relying on
  // offsetHeight alone, which doesn't change just because the header was
  // translated off-screen.
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
        // scrolling down — but never hide while the header is being interacted with
        if (!header.classList.contains('main-header--autohide-hidden')) {
          header.classList.add('main-header--autohide-hidden');
          syncBottomVar();
        }
      } else if (delta < 0) {
        // scrolling up
        if (header.classList.contains('main-header--autohide-hidden')) {
          header.classList.remove('main-header--autohide-hidden');
          syncBottomVar();
        }
      }
      // keep tracking position even while paused, so there's no big
      // stale delta the moment the pointer/focus leaves the header
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

(function () {
  'use strict';

  // Mobile/tablet hamburger + slide-in drawer, wired to the markup
  // rendered by snippets/header-menu.liquid (< 1024px).
  var trigger = document.getElementById('main-header-menu-trigger');
  var nav = document.getElementById('main-header-mobile-nav');
  if (!trigger || !nav) return;

  var closeEls = nav.querySelectorAll('[data-mobile-nav-close]');
  var toggles = nav.querySelectorAll('.ecombio-mobile-nav__toggle');

  var openDrawer = function () {
    nav.classList.add('is-open');
    nav.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
  };

  var closeDrawer = function () {
    nav.classList.remove('is-open');
    nav.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
  };

  trigger.addEventListener('click', function () {
    if (nav.classList.contains('is-open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  closeEls.forEach(function (el) {
    el.addEventListener('click', closeDrawer);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      closeDrawer();
      trigger.focus();
    }
  });

  // Accordion toggles for link-list / mega-menu / showcase submenus,
  // and their nested level-3 submenus — same handler for both since
  // they share the .ecombio-mobile-nav__toggle / __sub markup.
  toggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var subId = btn.getAttribute('aria-controls');
      var sub = subId ? document.getElementById(subId) : null;
      if (!sub) return;

      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');

      if (expanded) {
        sub.setAttribute('hidden', '');
      } else {
        sub.removeAttribute('hidden');
      }
    });
  });

  // Safety net: if the viewport crosses back into desktop while the
  // drawer is open (e.g. rotating a tablet, or resizing a browser
  // window), close it so it doesn't get stuck open behind the now-
  // visible desktop menu-bar.
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 1024 && nav.classList.contains('is-open')) {
      closeDrawer();
    }
  });
})();