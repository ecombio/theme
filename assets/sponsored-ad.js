/**
 * assets/sponsored-ads.js
 *
 * Carousel scroll behavior for in-feed sponsored ad units.
 * Used by: sponsored-products.liquid (carousel variant),
 *          sponsored-brands.liquid
 *
 * NOT VERIFIED AGAINST YOUR THEME. This was written with zero visibility
 * into any existing carousel implementation in this codebase
 * (product-carousel block, collection-carousel block, collection-feed.js,
 * etc.). If those already share a carousel utility, prefer wiring this
 * into that utility instead of shipping a third, independent
 * implementation — ask before deploying this as-is in a theme that may
 * already solve this problem elsewhere.
 *
 * Behavior:
 *   - Targets every [data-sponsored-track] element on the page.
 *   - Native scroll-snap (CSS) handles the visual snapping; this script
 *     adds:
 *       - Prev/Next buttons (inserted if not already present)
 *       - Keyboard arrow-key support when the track has focus
 *       - Drag-to-scroll with mouse (touch already works natively via
 *         -webkit-overflow-scrolling + overflow-x: auto in the CSS)
 *   - No external dependencies.
 */

(function () {
  'use strict';

  if (window.__sponsoredAdsCarouselLoaded) return;
  window.__sponsoredAdsCarouselLoaded = true;

  function initTrack(track) {
    if (track.dataset.sponsoredTrackInit) return;
    track.dataset.sponsoredTrackInit = 'true';

    track.setAttribute('tabindex', '0');
    track.setAttribute('role', 'region');
    if (!track.hasAttribute('aria-label')) {
      track.setAttribute('aria-label', 'Sponsored products carousel');
    }

    var wrapper = track.closest('[data-sponsored-block-id]') || track.parentElement;

    // ── Prev / Next buttons ────────────────────────────────────────────
    var controls = document.createElement('div');
    controls.className = 'sponsored-ads__controls';

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'sponsored-ads__nav-btn sponsored-ads__nav-btn--prev';
    prevBtn.setAttribute('aria-label', 'Scroll to previous products');
    prevBtn.innerHTML = '&larr;';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'sponsored-ads__nav-btn sponsored-ads__nav-btn--next';
    nextBtn.setAttribute('aria-label', 'Scroll to next products');
    nextBtn.innerHTML = '&rarr;';

    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    if (wrapper) {
      wrapper.appendChild(controls);
    }

    function itemWidth() {
      var firstItem = track.querySelector('li');
      if (!firstItem) return track.clientWidth;
      var style = window.getComputedStyle(track);
      var gap = parseFloat(style.gap || style.columnGap || '0') || 0;
      return firstItem.getBoundingClientRect().width + gap;
    }

    function scrollByAmount(direction) {
      var amount = itemWidth() * 2 * direction;
      track.scrollBy({ left: amount, behavior: 'smooth' });
    }

    function updateButtonState() {
      var maxScroll = track.scrollWidth - track.clientWidth;
      prevBtn.disabled = track.scrollLeft <= 0;
      nextBtn.disabled = track.scrollLeft >= maxScroll - 1;
    }

    prevBtn.addEventListener('click', function () {
      scrollByAmount(-1);
    });
    nextBtn.addEventListener('click', function () {
      scrollByAmount(1);
    });

    track.addEventListener('scroll', updateButtonState, { passive: true });
    window.addEventListener('resize', updateButtonState);
    updateButtonState();

    // ── Keyboard support ────────────────────────────────────────────────
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollByAmount(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollByAmount(-1);
      }
    });

    // ── Mouse drag-to-scroll ────────────────────────────────────────────
    var isDragging = false;
    var startX = 0;
    var startScroll = 0;

    track.addEventListener('mousedown', function (e) {
      isDragging = true;
      track.classList.add('sponsored-ads__track--dragging');
      startX = e.pageX;
      startScroll = track.scrollLeft;
    });

    window.addEventListener('mouseup', function () {
      isDragging = false;
      track.classList.remove('sponsored-ads__track--dragging');
    });

    window.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      e.preventDefault();
      var delta = e.pageX - startX;
      track.scrollLeft = startScroll - delta;
    });

    // Prevent click-through on links immediately after a drag.
    var dragDistance = 0;
    track.addEventListener('mousedown', function (e) {
      dragDistance = 0;
      startX = e.pageX;
    });
    window.addEventListener('mousemove', function (e) {
      if (isDragging) dragDistance += Math.abs(e.movementX || 0);
    });
    track.addEventListener(
      'click',
      function (e) {
        if (dragDistance > 5) {
          e.preventDefault();
        }
      },
      true
    );
  }

  function initAll() {
    var tracks = document.querySelectorAll('[data-sponsored-track]');
    tracks.forEach(initTrack);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Re-init on Shopify section reloads in the theme editor.
  document.addEventListener('shopify:section:load', initAll);
})();
