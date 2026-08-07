/* Optional scroll-reveal for sections/featured-images.liquid.
   This file is only requested when "Fade cards in on scroll" is enabled
   in the section settings — the grid itself has no other JS dependency
   (no arrows, dots, autoplay, or drag/scroll logic to manage). */

(() => {
  const REVEAL_SELECTOR = '[data-featured-images-reveal]';
  const CAROUSEL_SELECTOR = '[data-featured-images-carousel]';

  function initReveal(grid) {
    const cards = Array.from(grid.querySelectorAll('[data-featured-images-card]'));
    if (cards.length === 0) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      // CSS already forces full opacity/no-transform under this query,
      // so just skip the observer entirely rather than fighting it.
      return;
    }

    if (!('IntersectionObserver' in window)) {
      // No observer support — reveal everything immediately instead of
      // leaving cards permanently at opacity: 0.
      cards.forEach((card) => card.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    );

    cards.forEach((card, i) => {
      // Small stagger so a multi-card row doesn't pop in as one flat block.
      card.style.transitionDelay = `${i * 60}ms`;
      observer.observe(card);
    });
  }

  /* ---------------------------------------------------------------
     Carousel controller — only attaches to sections where
     "Enable carousel" is on. Handles prev/next, dot pagination,
     overflow fade-mask classes, and optional autoplay. Mirrors
     assets/banner-carousel.js's approach, scoped to this grid.
     --------------------------------------------------------------- */
  class FeaturedImagesCarousel {
    constructor(root) {
      this.root = root;
      this.track = root.querySelector('[data-featured-images-track]');
      this.prevBtn = root.querySelector('[data-featured-images-prev]');
      this.nextBtn = root.querySelector('[data-featured-images-next]');
      this.dotsWrapper = root.querySelector('[data-featured-images-dots]');
      this.cards = this.track ? Array.from(this.track.children) : [];

      if (!this.track || this.cards.length === 0) return;

      this.autoplayEnabled = root.dataset.autoplay === 'true';
      this.autoplaySpeed = parseInt(root.dataset.autoplaySpeed, 10) || 5000;
      this.autoplayTimer = null;
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.onPrevClick = this.onPrevClick.bind(this);
      this.onNextClick = this.onNextClick.bind(this);
      this.onScroll = this.onScroll.bind(this);
      this.onResize = this.onResize.bind(this);
      this.stopAutoplay = this.stopAutoplay.bind(this);
      this.maybeStartAutoplay = this.maybeStartAutoplay.bind(this);

      this.buildDots();
      this.bindEvents();
      this.update();

      if (this.autoplayEnabled && !this.reducedMotion) this.startAutoplay();
    }

    getCardsPerView() {
      const width = window.innerWidth;
      const styles = getComputedStyle(this.root);
      if (width >= 990) return parseFloat(styles.getPropertyValue('--columns-desktop')) || 1;
      if (width >= 750) return parseFloat(styles.getPropertyValue('--columns-tablet')) || 1;
      return parseFloat(styles.getPropertyValue('--columns-mobile')) || 1;
    }

    buildDots() {
      if (!this.dotsWrapper) return;
      this.dotsWrapper.innerHTML = '';
      this.dots = [];

      const perView = this.getCardsPerView();
      const pageCount = Math.max(1, Math.ceil(this.cards.length / perView));

      if (pageCount <= 1) {
        this.dotsWrapper.hidden = true;
        return;
      }

      this.dotsWrapper.hidden = false;
      for (let i = 0; i < pageCount; i++) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'featured-images-carousel__dot';
        dot.setAttribute('aria-label', `Go to slide group ${i + 1}`);
        if (i === 0) dot.classList.add('is-active');
        dot.addEventListener('click', () => this.goToPage(i));
        this.dotsWrapper.appendChild(dot);
        this.dots.push(dot);
      }
    }

    bindEvents() {
      if (this.prevBtn) this.prevBtn.addEventListener('click', this.onPrevClick);
      if (this.nextBtn) this.nextBtn.addEventListener('click', this.onNextClick);
      this.track.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onResize);
      window.addEventListener('load', () => this.update());

      if ('ResizeObserver' in window) {
        this.resizeObserver = new ResizeObserver(() => this.update());
        this.resizeObserver.observe(this.track);
      }

      ['pointerdown', 'focusin', 'mouseenter'].forEach((evt) => {
        this.root.addEventListener(evt, this.stopAutoplay);
      });
      ['pointerup', 'focusout', 'mouseleave'].forEach((evt) => {
        this.root.addEventListener(evt, this.maybeStartAutoplay);
      });
    }

    getStep() {
      const card = this.cards[0];
      const styles = getComputedStyle(this.track);
      const gap = parseFloat(styles.columnGap || styles.gap || '0');
      return card.getBoundingClientRect().width + gap;
    }

    onPrevClick() {
      const perView = Math.max(1, Math.floor(this.getCardsPerView()));
      this.track.scrollBy({ left: -this.getStep() * perView, behavior: this.reducedMotion ? 'auto' : 'smooth' });
    }

    onNextClick() {
      const perView = Math.max(1, Math.floor(this.getCardsPerView()));
      this.track.scrollBy({ left: this.getStep() * perView, behavior: this.reducedMotion ? 'auto' : 'smooth' });
    }

    goToPage(pageIndex) {
      const perView = this.getCardsPerView();
      const cardIndex = Math.round(pageIndex * perView);
      const target = this.cards[cardIndex];
      if (!target) return;
      this.track.scrollTo({
        left: target.offsetLeft - this.track.offsetLeft,
        behavior: this.reducedMotion ? 'auto' : 'smooth',
      });
    }

    onScroll() {
      if (this.scrollRaf) return;
      this.scrollRaf = requestAnimationFrame(() => {
        this.update();
        this.updateActiveDot();
        this.scrollRaf = null;
      });
    }

    onResize() {
      this.buildDots();
      this.update();
    }

    updateActiveDot() {
      if (!this.dots || this.dots.length === 0) return;
      const perView = this.getCardsPerView();
      const step = this.getStep();
      const pageIndex = Math.round(this.track.scrollLeft / (step * perView));
      this.dots.forEach((dot, i) => dot.classList.toggle('is-active', i === pageIndex));
    }

    update() {
      const { scrollLeft, scrollWidth, clientWidth } = this.track;
      const maxScroll = scrollWidth - clientWidth;
      const atStart = scrollLeft <= 1;
      const atEnd = scrollLeft >= maxScroll - 1;
      const hasOverflow = maxScroll > 1;

      if (this.prevBtn) this.prevBtn.disabled = !hasOverflow || atStart;
      if (this.nextBtn) this.nextBtn.disabled = !hasOverflow || atEnd;

      this.root.classList.toggle('has-overflow-start', hasOverflow && !atStart);
      this.root.classList.toggle('has-overflow-end', hasOverflow && !atEnd);
    }

    startAutoplay() {
      this.stopAutoplay();
      this.autoplayTimer = setInterval(() => {
        const { scrollLeft, scrollWidth, clientWidth } = this.track;
        if (scrollLeft + clientWidth >= scrollWidth - 1) {
          this.track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          this.onNextClick();
        }
      }, this.autoplaySpeed);
    }

    stopAutoplay() {
      if (this.autoplayTimer) {
        clearInterval(this.autoplayTimer);
        this.autoplayTimer = null;
      }
    }

    maybeStartAutoplay() {
      if (this.autoplayEnabled && !this.reducedMotion) this.startAutoplay();
    }
  }

  function init() {
    document.querySelectorAll(REVEAL_SELECTOR).forEach((grid) => {
      if (grid.__featuredImagesReveal) return;
      grid.__featuredImagesReveal = true;
      initReveal(grid);
    });

    document.querySelectorAll(CAROUSEL_SELECTOR).forEach((root) => {
      if (root.__featuredImagesCarousel) return;
      root.__featuredImagesCarousel = new FeaturedImagesCarousel(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init when Shopify theme editor injects/re-renders a section.
  document.addEventListener('shopify:section:load', (event) => {
    const reveal = event.target.querySelector(REVEAL_SELECTOR);
    if (reveal) {
      reveal.__featuredImagesReveal = false;
    }
    const carousel = event.target.querySelector(CAROUSEL_SELECTOR);
    if (carousel) {
      carousel.__featuredImagesCarousel = null;
    }
    init();
  });
})();