(function () {
  'use strict';

  /*
   * FIX — this used to be document.querySelector('[data-sticky-fixed="true"]'),
   * which was fine back when #main-header was the only element carrying that
   * attribute. Now that the announcement bar's own sticky setting adds the
   * identical attribute to itself, querySelector silently returned whichever
   * element comes first in the DOM (the announcement bar, since it renders
   * above Main header in the header-group) instead of the actual header —
   * so every measurement below was running against the wrong ~38px-tall
   * element. Targeting #main-header directly removes the ambiguity entirely,
   * regardless of how many other sections also opt into data-sticky-fixed.
   */
  var header = document.getElementById('main-header');
  if (!header) return;

  var announcementBar = document.querySelector('[data-announcement-bar]');
  var spacer = document.getElementById('main-header-sticky-spacer');

  /*
   * FIX — header-group stacking: main-header.css reads
   * --main-header-stack-offset to position #main-header below whatever is
   * pinned above it, instead of hardcoding top: 0 and overlapping it. Only
   * counts the announcement bar's height when it's actually part of the
   * fixed stack (its own "Stick to top of viewport" setting is on, which is
   * the only time announcement-bar.liquid adds data-sticky-fixed to it) —
   * if that setting is off, or the bar has been dismissed (its own JS sets
   * display:none, which naturally collapses offsetHeight to 0), the offset
   * drops back to 0 and main-header returns to sitting flush at the top.
   */
  var getStackOffset = function () {
    if (announcementBar && announcementBar.hasAttribute('data-sticky-fixed')) {
      return announcementBar.offsetHeight;
    }
    return 0;
  };

  var sync = function () {
    var stackOffset = getStackOffset();
    document.documentElement.style.setProperty('--main-header-stack-offset', stackOffset + 'px');

    var full = header.offsetHeight;

    var hidden = header.classList.contains('main-header--autohide-hidden');
    var offset = hidden ? 0 : full;

    document.documentElement.style.setProperty('--main-header-bottom', offset + 'px');

    // Spacer reserves space for the WHOLE fixed stack (announcement bar +
    // main header), not just main-header alone, so page content below
    // doesn't jump up into the space the announcement bar used to occupy.
    if (spacer) spacer.style.height = (full + stackOffset) + 'px';
  };

  sync();
  window.addEventListener('resize', sync);

  if ('ResizeObserver' in window) {
    new ResizeObserver(sync).observe(header);
    if (announcementBar) new ResizeObserver(sync).observe(announcementBar);
  }

  /*
   * FIX — sync() above runs immediately on script execution, which can be
   * before the logo image or webfonts have finished loading. If the header
   * grows/shrinks after that point without triggering a ResizeObserver
   * callback (some browsers coalesce a resize that happens in the same
   * frame the observer was attached), the spacer is left holding a stale
   * height — this is what caused the leftover blank gap under the header.
   * Re-running sync() once everything has actually finished loading closes
   * that gap without changing any of the autohide/scroll behavior below.
   */
  window.addEventListener('load', sync);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(sync);
  }

  window.__mainHeaderSync = sync;
})();

(function () {
  'use strict';

  // Same fix as the IIFE above — target #main-header directly rather than
  // the now-ambiguous [data-sticky-fixed="true"] attribute selector.
  var header = document.getElementById('main-header');
  if (!header || header.dataset.autohide !== 'true') return;

  /*
   * FIX — announcement-bar.liquid's own "Stick to top of viewport" setting
   * says explicitly: "There's no separate autohide setting here; the
   * header's controls the whole stack." Nothing previously read that
   * intent — the announcement bar's --autohide-hidden class was never
   * toggled by anything. It exposes data-autohide-class with its own class
   * name (announcement-bar--autohide-hidden, vs. main-header's
   * main-header--autohide-hidden) specifically so a shared handler like
   * this one can toggle both in lockstep without hardcoding either name.
   * main-header itself doesn't set data-autohide-class, so it falls back
   * to its existing hardcoded class below — no liquid changes required.
   */
  var announcementBar = document.querySelector('[data-announcement-bar]');
  var announcementAutohideClass = announcementBar && announcementBar.dataset.autohideClass;
  var stackIncludesAnnouncement = announcementBar && announcementBar.hasAttribute('data-sticky-fixed') && announcementAutohideClass;

  var THRESHOLD = 8;
  var REVEAL_ZONE = 80;

  var lastY = window.scrollY;
  var ticking = false;
  var isPaused = false;

  var syncBottomVar = function () {
    if (window.__mainHeaderSync) window.__mainHeaderSync();
  };

  var setHidden = function (hidden) {
    header.classList.toggle('main-header--autohide-hidden', hidden);
    if (stackIncludesAnnouncement) {
      announcementBar.classList.toggle(announcementAutohideClass, hidden);
    }
    syncBottomVar();
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
      setHidden(false);
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
        setHidden(false);
      }
      lastY = currentY;
    } else if (Math.abs(delta) > THRESHOLD) {
      if (delta > 0 && !isPaused) {
        if (!header.classList.contains('main-header--autohide-hidden')) {
          setHidden(true);
        }
      } else if (delta < 0) {
        if (header.classList.contains('main-header--autohide-hidden')) {
          setHidden(false);
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

/*
 * FIX — menu-bar.has-scroll-left / has-scroll-right (main-header.css) and
 * the .menu-bar__edge-fade--left / --right elements (header-menu.liquid)
 * were both already in place, but nothing ever toggled those classes, so
 * the white edge-fade never appeared regardless of overflow state. This
 * lives here (rather than inside mega-menu.js / showcase.js / link-list.js)
 * because .menu-bar renders whenever section.blocks.size > 0, independent
 * of which block types are present — those three scripts only load
 * conditionally per block type and can't be relied on to cover every case.
 *
 * The actual scrolling element changes by breakpoint:
 *   - >=1024px: overflow-x lives on .menu-bar__container
 *   - <640px with .main-header--menu-bar-mobile-visible: overflow-x lives
 *     on .menu-bar itself
 * getScrollEl() below picks whichever one is actually overflowing.
 */
(function () {
  'use strict';

  var menuBar = document.getElementById('main-header-menu-bar');
  if (!menuBar) return;

  var BUFFER = 1; // guards against sub-pixel scrollLeft/maxScroll mismatches at the true end

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
      // nothing to scroll in either direction — no fade either side
      menuBar.classList.remove('has-scroll-left', 'has-scroll-right');
      return;
    }

    menuBar.classList.toggle('has-scroll-left', el.scrollLeft > BUFFER);
    menuBar.classList.toggle('has-scroll-right', el.scrollLeft < maxScroll - BUFFER);
  };

  var scrollTarget = menuBar.querySelector('.menu-bar__container') || menuBar;

  update();
  scrollTarget.addEventListener('scroll', update, { passive: true });
  menuBar.addEventListener('scroll', update, { passive: true }); // covers the <640px mobile-visible case where .menu-bar itself scrolls
  window.addEventListener('resize', update);

  if ('ResizeObserver' in window) {
    new ResizeObserver(update).observe(menuBar);
  }
})();