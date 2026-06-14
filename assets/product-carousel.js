/* ============================================================
   product-carousel.js
   Lightweight, dependency-free carousel.
   Features: arrow nav · dot nav · drag/swipe · autoplay ·
             reduced-motion · keyboard accessible ·
             respects cards-per-row settings from section data attrs
   ============================================================ */

(function () {
  'use strict';

  function initCarousel(section) {
    var track       = section.querySelector('[data-carousel-track]');
    var wrapper     = section.querySelector('[data-carousel-wrapper]');
    var prevBtn     = section.querySelector('[data-carousel-prev]');
    var nextBtn     = section.querySelector('[data-carousel-next]');
    var dotsEl      = section.querySelector('[data-carousel-dots]');
    var slides      = Array.from(section.querySelectorAll('[data-carousel-slide]'));

    if (!track || slides.length === 0) return;

    /* ── Read settings from data attributes ── */
    var colsDesktop  = parseInt(section.dataset.cardsDesktop, 10) || 4;
    var colsMobile   = parseInt(section.dataset.cardsMobile,  10) || 2;
    var autoplay     = section.dataset.autoplay === 'true';
    var autoplayMs   = parseInt(section.dataset.autoplayInterval, 10) || 4000;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── Push CSS custom properties for slide sizing ── */
    section.style.setProperty('--_cols-desktop', colsDesktop);
    section.style.setProperty('--_cols-mobile',  colsMobile);

    /* ── State ── */
    var index      = 0;   // current first-visible slide index
    var autoTimer  = null;

    /* ── Helpers ── */
    function visibleCols() {
      return window.innerWidth >= 768 ? colsDesktop : colsMobile;
    }

    function maxIndex() {
      return Math.max(0, slides.length - visibleCols());
    }

    function slideWidth() {
      /* gap is in px from computed style */
      var gap  = parseFloat(getComputedStyle(track).gap) || 16;
      var cols = visibleCols();
      return (wrapper.offsetWidth - gap * (cols - 1)) / cols + gap;
    }

    function clamp(val, lo, hi) {
      return Math.min(Math.max(val, lo), hi);
    }

    /* ── Render position ── */
    function applyTranslate(offset, instant) {
      track.style.transition = (instant || reducedMotion)
        ? 'none'
        : 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)';
      track.style.transform  = 'translateX(-' + offset + 'px)';
    }

    function goTo(newIndex, instant) {
      index = clamp(newIndex, 0, maxIndex());
      applyTranslate(index * slideWidth(), instant);
      updateControls();
    }

    /* ── Controls state ── */
    function updateControls() {
      if (prevBtn) prevBtn.classList.toggle('is-hidden', index === 0);
      if (nextBtn) nextBtn.classList.toggle('is-hidden', index >= maxIndex());
      updateDots();
    }

    /* ── Dot indicators ── */
    function buildDots() {
      if (!dotsEl) return;
      dotsEl.innerHTML = '';
      var total = maxIndex() + 1;
      for (var i = 0; i < total; i++) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'product-carousel__dot' + (i === 0 ? ' is-active' : '');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.dataset.dotIndex = i;
        dotsEl.appendChild(dot);
      }
      dotsEl.addEventListener('click', function (e) {
        var dot = e.target.closest('[data-dot-index]');
        if (!dot) return;
        goTo(parseInt(dot.dataset.dotIndex, 10));
        resetAutoplay();
      });
    }

    function updateDots() {
      if (!dotsEl) return;
      var dots = dotsEl.querySelectorAll('.product-carousel__dot');
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === index);
      });
    }

    /* ── Arrow buttons ── */
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        goTo(index - 1);
        resetAutoplay();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        goTo(index + 1);
        resetAutoplay();
      });
    }

    /* ── Keyboard on track ── */
    track.setAttribute('tabindex', '0');
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { goTo(index - 1); resetAutoplay(); e.preventDefault(); }
      if (e.key === 'ArrowRight') { goTo(index + 1); resetAutoplay(); e.preventDefault(); }
    });

    /* ── Drag / swipe ── */
    var dragStart = null;
    var dragCurrent = null;
    var isDragging = false;

    function onPointerDown(e) {
      dragStart   = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      dragCurrent = dragStart;
      isDragging  = false;
      track.classList.remove('is-dragging');
    }

    function onPointerMove(e) {
      if (dragStart === null) return;
      dragCurrent = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
      if (Math.abs(dragCurrent - dragStart) > 6) {
        isDragging = true;
        track.classList.add('is-dragging');
        var live = index * slideWidth() - (dragCurrent - dragStart);
        applyTranslate(Math.max(0, live), true);
        if (e.cancelable) e.preventDefault();
      }
    }

    function onPointerUp() {
      if (dragStart === null) return;
      var delta = dragCurrent - dragStart;
      var threshold = slideWidth() * 0.2;
      if (isDragging) {
        if (delta < -threshold) goTo(index + 1);
        else if (delta > threshold) goTo(index - 1);
        else goTo(index);
      }
      dragStart = dragCurrent = null;
      isDragging = false;
      track.classList.remove('is-dragging');
      resetAutoplay();
    }

    track.addEventListener('mousedown',  onPointerDown);
    track.addEventListener('mousemove',  onPointerMove);
    track.addEventListener('mouseup',    onPointerUp);
    track.addEventListener('mouseleave', onPointerUp);
    track.addEventListener('touchstart', onPointerDown, { passive: true });
    track.addEventListener('touchmove',  onPointerMove, { passive: false });
    track.addEventListener('touchend',   onPointerUp);

    /* prevent clicks on children after a drag */
    track.addEventListener('click', function (e) {
      if (isDragging) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    /* ── Autoplay ── */
    function startAutoplay() {
      if (!autoplay || reducedMotion) return;
      autoTimer = setInterval(function () {
        goTo(index >= maxIndex() ? 0 : index + 1);
      }, autoplayMs);
    }
    function stopAutoplay()  { clearInterval(autoTimer); }
    function resetAutoplay() { stopAutoplay(); startAutoplay(); }

    section.addEventListener('mouseenter', stopAutoplay);
    section.addEventListener('mouseleave', startAutoplay);
    section.addEventListener('focusin',    stopAutoplay);
    section.addEventListener('focusout',   startAutoplay);

    /* ── Recalculate on resize ── */
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        buildDots();
        goTo(clamp(index, 0, maxIndex()), true);
      }, 150);
    });

    /* ── Init ── */
    buildDots();
    goTo(0, true);
    startAutoplay();
  }

  /* ── Bootstrap all carousels on the page ── */
  function init() {
    document.querySelectorAll('.product-carousel').forEach(initCarousel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Shopify theme editor live reload ── */
  document.addEventListener('shopify:section:load', function (e) {
    var sec = e.target.querySelector('.product-carousel');
    if (sec) initCarousel(sec);
  });

})();