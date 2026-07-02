(() => {
  const SELECTOR = '[data-banner-carousel]';
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  class BannerCarousel {
    constructor(root) {
      this.root = root;
      this.track = root.querySelector('[data-banner-carousel-track]');
      this.slides = Array.from(root.querySelectorAll('[data-banner-carousel-slide]'));
      this.prevBtn = root.querySelector('[data-banner-carousel-prev]');
      this.nextBtn = root.querySelector('[data-banner-carousel-next]');
      this.dotsWrap = root.querySelector('[data-banner-carousel-dots]');
      this.dots = this.dotsWrap
        ? Array.from(this.dotsWrap.querySelectorAll('[data-banner-carousel-dot]'))
        : [];

      if (!this.track || this.slides.length === 0) return;

      this.autoplay = root.dataset.autoplay === 'true';
      this.autoplaySpeed = parseInt(root.dataset.autoplaySpeed, 10) || 5000;
      this.timer = null;
      this.activeIndex = 0;
      this.scrollRaf = null;
      this.resizeRaf = null;

      this.onPrev = this.onPrev.bind(this);
      this.onNext = this.onNext.bind(this);
      this.onScroll = this.onScroll.bind(this);
      this.onResize = this.onResize.bind(this);
      this.pause = this.pause.bind(this);
      this.maybeResume = this.maybeResume.bind(this);

      this.bindEvents();
      this.updateActive();
      this.maybeResume();
    }

    bindEvents() {
      if (this.prevBtn) this.prevBtn.addEventListener('click', this.onPrev);
      if (this.nextBtn) this.nextBtn.addEventListener('click', this.onNext);

      this.dots.forEach((dot, i) => {
        dot.addEventListener('click', () => this.goTo(i));
      });

      this.track.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onResize);

      // Autoplay pauses on any user interaction and resumes once it ends
      this.root.addEventListener('mouseenter', this.pause);
      this.root.addEventListener('mouseleave', this.maybeResume);
      this.root.addEventListener('focusin', this.pause);
      this.root.addEventListener('focusout', this.maybeResume);
      this.track.addEventListener('pointerdown', this.pause);
      this.track.addEventListener('pointerup', this.maybeResume);

      reduceMotionQuery.addEventListener?.('change', this.maybeResume);
    }

    goTo(index, behavior) {
      const count = this.slides.length;
      const clamped = ((index % count) + count) % count;
      const left = this.slides[clamped].offsetLeft;
      const scrollBehavior = behavior || (reduceMotionQuery.matches ? 'auto' : 'smooth');
      this.track.scrollTo({ left, behavior: scrollBehavior });
      this.activeIndex = clamped;
      this.updateDots();
    }

    onPrev() {
      this.pause();
      this.goTo(this.activeIndex - 1);
      this.maybeResume();
    }

    onNext() {
      this.pause();
      this.goTo(this.activeIndex + 1);
      this.maybeResume();
    }

    onScroll() {
      if (this.scrollRaf) return;
      this.scrollRaf = requestAnimationFrame(() => {
        this.updateActive();
        this.scrollRaf = null;
      });
    }

    updateActive() {
      const scrollLeft = this.track.scrollLeft;
      let closest = 0;
      let closestDist = Infinity;
      this.slides.forEach((slide, i) => {
        const dist = Math.abs(slide.offsetLeft - scrollLeft);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      });
      this.activeIndex = closest;
      this.updateDots();
    }

    updateDots() {
      this.dots.forEach((dot, i) => {
        const isActive = i === this.activeIndex;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    }

    onResize() {
      if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => {
        this.goTo(this.activeIndex, 'auto');
      });
    }

    play() {
      this.stop();
      this.timer = setInterval(() => {
        this.goTo(this.activeIndex + 1);
      }, this.autoplaySpeed);
    }

    stop() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }

    pause() {
      this.stop();
    }

    maybeResume() {
      const shouldPlay = this.autoplay && this.slides.length > 1 && !reduceMotionQuery.matches;
      if (shouldPlay) {
        this.play();
      } else {
        this.stop();
      }
    }
  }

  function init() {
    document.querySelectorAll(SELECTOR).forEach((root) => {
      if (root.__bannerCarousel) return;
      root.__bannerCarousel = new BannerCarousel(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init when Shopify theme editor injects/re-renders a section
  document.addEventListener('shopify:section:load', (event) => {
    const root = event.target.querySelector(SELECTOR);
    if (root) root.__bannerCarousel = new BannerCarousel(root);
  });

  // Tear down the timer so a removed/re-rendered section doesn't keep ticking
  document.addEventListener('shopify:section:unload', (event) => {
    const root = event.target.querySelector(SELECTOR);
    if (root && root.__bannerCarousel) root.__bannerCarousel.stop();
  });
})();