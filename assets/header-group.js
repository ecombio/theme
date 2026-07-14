

(function () {
  'use strict';

  var wrapper = document.getElementById('shopify-section-group-header-group');
  var mainHeader = document.getElementById('main-header');
  if (!wrapper || !mainHeader) return;

  var stickyEnabled = mainHeader.dataset.stickyFixed === 'true';
  var autohideEnabled = mainHeader.dataset.autohide === 'true';

  if (!stickyEnabled) return; // group stays in normal flow, nothing to do

  wrapper.classList.add('header-group--sticky-enabled');

  var spacer = document.getElementById('header-group-sticky-spacer');

  var getMembers = function () {
    return Array.prototype.slice.call(
      wrapper.querySelectorAll('[data-header-stack-member]')
    );
  };

  var sync = function () {
    var members = getMembers();
    var offset = 0;

    members.forEach(function (el) {
      el.style.setProperty('--stack-offset-top', offset + 'px');
      // A dismissed/disabled member (display:none via its own JS, or not
      // rendered at all) naturally collapses offsetHeight to 0, so it
      // drops out of the stack automatically — same behavior the old
      // announcement-bar-only offset math relied on.
      offset += el.offsetHeight;
    });

    if (spacer) spacer.style.height = offset + 'px';
    document.documentElement.style.setProperty('--header-group-height', offset + 'px');
  };

  sync();
  window.addEventListener('resize', sync);

  /*
   * Same fix as the old main-header.js: the first sync() can run before
   * logos/webfonts finish loading and change a member's real height, and
   * some browsers coalesce a resize that happens in the same frame a
   * ResizeObserver was attached — so re-run once everything has actually
   * finished loading to avoid a stale spacer height / leftover gap.
   */
  window.addEventListener('load', sync);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(sync);
  }

  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(sync);
    getMembers().forEach(function (el) { ro.observe(el); });
  }

  window.__headerGroupSync = sync;

  // ---- Autohide (scroll direction) ------------------------------------
  if (!autohideEnabled) return;

  var THRESHOLD = 8;
  var REVEAL_ZONE = 80;
  var lastY = window.scrollY;
  var ticking = false;
  var isPaused = false;

  var setHidden = function (hidden) {
    wrapper.classList.toggle('header-group--autohide-hidden', hidden);
  };

  mainHeader.addEventListener('mouseenter', function () { isPaused = true; });
  mainHeader.addEventListener('mouseleave', function () { isPaused = false; });
  mainHeader.addEventListener('focusin', function () { isPaused = true; });
  mainHeader.addEventListener('focusout', function () { isPaused = false; });

  /*
   * The predictive search dropdown can open/close without a matching
   * focusin/focusout on the header (e.g. dismissed via Escape or an
   * outside click that never focused anything inside <header>).
   * header-search.js dispatches these two events on the document to
   * cover that gap explicitly — same contract the old main-header.js
   * autohide IIFE relied on.
   */
  document.addEventListener('header-search:open', function () {
    isPaused = true;
    setHidden(false);
  });
  document.addEventListener('header-search:close', function () {
    isPaused = false;
  });

  var onScroll = function () {
    var currentY = window.scrollY;
    var delta = currentY - lastY;

    if (currentY <= REVEAL_ZONE) {
      setHidden(false);
      lastY = currentY;
    } else if (Math.abs(delta) > THRESHOLD) {
      if (delta > 0 && !isPaused) {
        setHidden(true);
      } else if (delta < 0) {
        setHidden(false);
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
