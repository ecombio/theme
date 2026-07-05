/**
 * promo-carousel.js
 * Powers snippets/promo-carousel.liquid
 *
 * Features per carousel instance:
 *   • Tab switching (tab bar → panel swap)
 *   • Track sliding (CSS transform)
 *   • Prev / next arrows (top, bottom, or side positions)
 *   • Dot indicators
 *   • Drag / swipe (pointer events)
 *   • Autoplay with pause-on-hover
 *   • Responsive column count via data attributes
 *   • ResizeObserver recalculates on viewport change
 *
 * Markup contracts (from promo-carousel.liquid):
 *   [data-section-id]          — unique ID per carousel instance
 *   [data-cards-desktop]       — columns on ≥768px
 *   [data-cards-mobile]        — columns on <768px
 *   [data-autoplay]            — "true" | "false"
 *   [data-autoplay-interval]   — ms (e.g. 4000)
 *   [data-carousel-tab]        — tab buttons
 *   [data-carousel-panel]      — tab panels
 *   [data-carousel-track]      — <ul> slide list
 *   [data-carousel-wrapper]    — overflow:hidden container
 *   [data-carousel-slide]      — individual <li> slides
 *   [data-carousel-prev]       — prev button (any position)
 *   [data-carousel-next]       — next button (any position)
 *   [data-carousel-top-prev]   — prev button in top-arrows variant
 *   [data-carousel-top-next]   — next button in top-arrows variant
 *   [data-carousel-dots]       — dot container
 *
 * NOTE: product-card.js is loaded globally — do NOT re-initialise
 * card features here. Double-registration causes duplicate ATC calls.
 */

(function () {
  'use strict';

  /* ── Per-instance init ─────────────────────────────────────── */
  function initCarousel(section) {
    var sectionId   = section.dataset.sectionId;
    var cardsDesk   = parseInt(section.dataset.cardsDesktop, 10) || 3;
    var cardsMob    = parseInt(section.dataset.cardsMobile,  10) || 2;
    var autoplay    = section.dataset.autoplay === 'true';
    var autoplayMs  = parseInt(section.dataset.autoplayInterval, 10) || 4000;

    /* ── Tabs ──────────────────────────────────────────────── */
    var tabBtns  = section.querySelectorAll('[data-carousel-tab]');
    var panels   = section.querySelectorAll('[data-carousel-panel]');

    function activateTab(targetId) {
      tabBtns.forEach(function (btn) {
        var on = btn.dataset.carouselTab === targetId;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.forEach(function (panel) {
        var on = panel.dataset.carouselPanel === targetId;
        panel.classList.toggle('is-hidden', !on);
        if (on) {
          // Re-init track for newly visible panel
          var track = panel.querySelector('[data-carousel-track]');
          if (track && track._carouselState) {
            track._carouselState.goTo(0, false);
            track._carouselState.updateNav();
          }
        }
      });
    }

    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activateTab(btn.dataset.carouselTab);
      });
    });

    /* ── Per-panel track init ──────────────────────────────── */
    panels.forEach(function (panel) {
      var track   = panel.querySelector('[data-carousel-track]');
      var wrapper = panel.querySelector('[data-carousel-wrapper]');
      var slides  = panel.querySelectorAll('[data-carousel-slide]');
      var dots    = panel.querySelector('[data-carousel-dots]')
                    || section.querySelector('[data-carousel-dots]');

      // Arrow sets — a panel can have its own, or share top-level arrows
      var prevBtns = Array.from(panel.querySelectorAll('[data-carousel-prev]'))
        .concat(Array.from(section.querySelectorAll('[data-carousel-top-prev]')));
      var nextBtns = Array.from(panel.querySelectorAll('[data-carousel-next]'))
        .concat(Array.from(section.querySelectorAll('[data-carousel-top-next]')));

      if (!track || !slides.length) return;

      var current    = 0;
      var slideCount = slides.length;
      var perPage    = 1;
      var autoTimer  = null;

      function getPerPage() {
        return window.innerWidth >= 768 ? cardsDesk : cardsMob;
      }

      function maxIndex() {
        return Math.max(0, slideCount - perPage);
      }

      function slideWidth() {
        return slides[0] ? slides[0].getBoundingClientRect().width : 0;
      }

      function gapWidth() {
        var style = window.getComputedStyle(track);
        return parseFloat(style.gap) || parseFloat(style.columnGap) || 12;
      }

      function goTo(index, animate) {
        current = Math.max(0, Math.min(index, maxIndex()));
        var offset = current * (slideWidth() + gapWidth());
        track.style.transition = animate === false ? 'none' : '';
        track.style.transform  = 'translateX(-' + offset + 'px)';
        updateNav();
        updateDots();
      }

      function updateNav() {
        prevBtns.forEach(function (btn) {
          btn.disabled = current <= 0;
        });
        nextBtns.forEach(function (btn) {
          btn.disabled = current >= maxIndex();
        });
      }

      function buildDots() {
        if (!dots) return;
        dots.innerHTML = '';
        var pages = maxIndex() + 1;
        for (var i = 0; i < pages; i++) {
          var dot = document.createElement('button');
          dot.className = 'product-carousel__dot' + (i === 0 ? ' is-active' : '');
          dot.type = 'button';
          dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
          dot.dataset.dotIndex = i;
          dots.appendChild(dot);
        }
        dots.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-dot-index]');
          if (btn) goTo(parseInt(btn.dataset.dotIndex, 10), true);
        });
      }

      function updateDots() {
        if (!dots) return;
        dots.querySelectorAll('.product-carousel__dot').forEach(function (dot, i) {
          dot.classList.toggle('is-active', i === current);
        });
      }

      function recalc() {
        perPage = getPerPage();
        // Update CSS custom props so slide flex-basis stays correct
        section.style.setProperty('--_cols-desktop', cardsDesk);
        section.style.setProperty('--_cols-mobile',  cardsMob);
        // Clamp and re-render
        current = Math.min(current, maxIndex());
        goTo(current, false);
        buildDots();
        updateDots();
      }

      /* ── Arrows ────────────────────────────────────────── */
      prevBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          goTo(current - 1, true);
          resetAutoplay();
        });
      });

      nextBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          goTo(current + 1, true);
          resetAutoplay();
        });
      });

      /* ── Autoplay ──────────────────────────────────────── */
      function startAutoplay() {
        if (!autoplay) return;
        autoTimer = setInterval(function () {
          goTo(current >= maxIndex() ? 0 : current + 1, true);
        }, autoplayMs);
      }

      function stopAutoplay() {
        clearInterval(autoTimer);
      }

      function resetAutoplay() {
        stopAutoplay();
        startAutoplay();
      }

      section.addEventListener('mouseenter', stopAutoplay);
      section.addEventListener('mouseleave', startAutoplay);
      section.addEventListener('focusin',    stopAutoplay);
      section.addEventListener('focusout',   startAutoplay);

      /* ── Drag / swipe ──────────────────────────────────── */
      var dragStart = null;
      var dragThreshold = 40;

      track.addEventListener('pointerdown', function (e) {
        dragStart = e.clientX;
        track.classList.add('is-dragging');
        track.setPointerCapture(e.pointerId);
      });

      track.addEventListener('pointerup', function (e) {
        if (dragStart === null) return;
        var delta = dragStart - e.clientX;
        track.classList.remove('is-dragging');

        if (Math.abs(delta) > dragThreshold) {
          goTo(delta > 0 ? current + 1 : current - 1, true);
          resetAutoplay();
        }
        dragStart = null;
      });

      track.addEventListener('pointermove', function (e) {
        if (dragStart === null) return;
        // Prevent page scroll while dragging horizontally
        if (Math.abs(e.clientX - dragStart) > 8) e.preventDefault();
      }, { passive: false });

      track.addEventListener('pointercancel', function () {
        track.classList.remove('is-dragging');
        dragStart = null;
      });

      /* ── Prevent click-through after drag ──────────────── */
      track.addEventListener('click', function (e) {
        if (track.classList.contains('is-dragging')) e.preventDefault();
      }, true);

      /* ── ResizeObserver ────────────────────────────────── */
      if (window.ResizeObserver) {
        new ResizeObserver(recalc).observe(wrapper || track);
      }

      /* ── Expose state for tab switching ────────────────── */
      track._carouselState = { goTo: goTo, updateNav: updateNav };

      /* ── Init ──────────────────────────────────────────── */
      recalc();
      startAutoplay();
    });
  }

  /* ── Find and init all carousel instances ─────────────────── */
  function initAll() {
    document.querySelectorAll('[data-section-id]').forEach(function (section) {
      // Scope to promo-carousel sections only (have a carousel track inside)
      if (section.querySelector('[data-carousel-track]')) {
        initCarousel(section);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

})();
