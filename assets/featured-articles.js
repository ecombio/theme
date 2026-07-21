class FeaturedArticlesCarousel extends HTMLElement {
  constructor() {
    super();
    this.track = this.querySelector('.featured-articles__track');
    this.prevBtn = this.querySelector('.featured-articles__nav-btn--prev');
    this.nextBtn = this.querySelector('.featured-articles__nav-btn--next');

    if (!this.track) return;

    this.slides = Array.from(this.track.children);
    this.onPrevClick = this.onPrevClick.bind(this);
    this.onNextClick = this.onNextClick.bind(this);
    this.updateButtons = this.updateButtons.bind(this);

    this.prevBtn?.addEventListener('click', this.onPrevClick);
    this.nextBtn?.addEventListener('click', this.onNextClick);
    this.track.addEventListener('scroll', this.debounce(this.updateButtons, 100), { passive: true });
    window.addEventListener('resize', this.debounce(this.updateButtons, 150));

    this.enableDrag();
    this.updateButtons();
  }

  debounce(fn, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  getSlideStep() {
    const slide = this.slides[0];
    if (!slide) return 0;
    const style = window.getComputedStyle(this.track);
    const gap = parseFloat(style.columnGap || style.gap || '0');
    return slide.getBoundingClientRect().width + gap;
  }

  onPrevClick() {
    this.track.scrollBy({ left: -this.getSlideStep(), behavior: 'smooth' });
  }

  onNextClick() {
    this.track.scrollBy({ left: this.getSlideStep(), behavior: 'smooth' });
  }

  updateButtons() {
    const { scrollLeft, scrollWidth, clientWidth } = this.track;
    const maxScroll = scrollWidth - clientWidth - 1;

    if (this.prevBtn) this.prevBtn.disabled = scrollLeft <= 0;
    if (this.nextBtn) this.nextBtn.disabled = scrollLeft >= maxScroll;
  }

  enableDrag() {
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;

    const onPointerDown = (e) => {
      isDown = true;
      this.track.classList.add('is-dragging');
      startX = e.pageX ?? e.touches?.[0]?.pageX ?? 0;
      scrollStart = this.track.scrollLeft;
    };

    const onPointerMove = (e) => {
      if (!isDown) return;
      const x = e.pageX ?? e.touches?.[0]?.pageX ?? 0;
      const walk = x - startX;
      this.track.scrollLeft = scrollStart - walk;
    };

    const onPointerUp = () => {
      isDown = false;
      this.track.classList.remove('is-dragging');
    };

    this.track.addEventListener('mousedown', onPointerDown);
    this.track.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    this.track.addEventListener('mouseleave', onPointerUp);
  }
}

document.querySelectorAll('.featured-articles').forEach((el) => {
  if (!el.dataset.carouselInit) {
    el.dataset.carouselInit = 'true';
    Object.setPrototypeOf(el, FeaturedArticlesCarousel.prototype);
    FeaturedArticlesCarousel.call(el);
  }
});

document.addEventListener('shopify:section:load', (event) => {
  const el = event.target.querySelector('.featured-articles');
  if (el && !el.dataset.carouselInit) {
    el.dataset.carouselInit = 'true';
    Object.setPrototypeOf(el, FeaturedArticlesCarousel.prototype);
    FeaturedArticlesCarousel.call(el);
  }
});