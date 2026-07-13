(function () {
  'use strict';

  // Gives every sticky-enabled header-group section (this one, plus
  // announcement/utility if they're present and sticky too) the correct
  // top offset based on DOM order. Guarded so only one copy ever runs —
  // that's deliberate: if the other sections get removed from the theme
  // entirely, this file still carries its own working copy and needs
  // nothing else.
  if (!window.__stickyStackInitialized) {
    window.__stickyStackInitialized = true;

    var getStickyEls = function () {
      return Array.prototype.slice.call(
        document.querySelectorAll('[data-sticky-fixed="true"]')
      );
    };

    var stackLayout = function () {
      var offset = 0;
      getStickyEls().forEach(function (el) {
        el.style.setProperty('--sticky-offset', offset + 'px');
        offset += el.offsetHeight;
      });
      document.documentElement.style.setProperty('--sticky-stack-height', offset + 'px');
    };

    stackLayout();
    window.addEventListener('resize', stackLayout);
    window.addEventListener('load', stackLayout);

    getStickyEls().forEach(function (el) {
      if ('ResizeObserver' in window) {
        new ResizeObserver(stackLayout).observe(el);
      }
    });

    document.addEventListener('shopify:section:load', stackLayout);
    document.addEventListener('shopify:section:unload', stackLayout);
    document.addEventListener('shopify:section:reorder', stackLayout);

    window.__stickyStackLayout = stackLayout;
  }
})();

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

  // Real position:sticky reserves its own space in normal document flow
  // automatically — no spacer element needed. --main-header-bottom is
  // still useful for anything below the header (e.g. collection-toolbar's
  // `top`) that wants to know how much of the header is actually visible
  // right now, since that collapses to 0 while autohide has translated
  // the header off-screen.
  var header = document.querySelector('[data-sticky-fixed="true"]');
  if (!header) return;

  var sync = function () {
    var full = header.offsetHeight;
    var hidden = header.classList.contains('main-header--autohide-hidden');
    var offset = hidden ? 0 : full;
    document.documentElement.style.setProperty('--main-header-bottom', offset + 'px');
  };

  sync();
  window.addEventListener('resize', sync);

  if ('ResizeObserver' in window) {
    new ResizeObserver(sync).observe(header);
  }

  // Exposed so the autohide script below can re-run this after it
  // toggles main-header--autohide-hidden.
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

  header.addEventListener('mouseenter', function () { isPaused = true; });
  header.addEventListener('mouseleave', function () { isPaused = false; });
  header.addEventListener('focusin', function () { isPaused = true; });
  header.addEventListener('focusout', function () { isPaused = false; });

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

(function () {
  'use strict';

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

  window.addEventListener('resize', function () {
    if (window.innerWidth >= 1024 && nav.classList.contains('is-open')) {
      closeDrawer();
    }
  });
})();