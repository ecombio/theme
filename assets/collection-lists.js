(() => {
  const SELECTOR = '[data-cl-content]';
  const BUFFER = 20; // px tolerance before bothering to collapse

  class CollectionsList {
    constructor(content) {
      this.content = content;
      this.inner = content.querySelector('[data-cl-content-inner]');
      this.section = content.closest('.cl-section');
      this.toggle = this.section ? this.section.querySelector('[data-cl-toggle]') : null;
      this.toggleLabel = this.toggle ? this.toggle.querySelector('[data-cl-toggle-label]') : null;

      if (!this.content.classList.contains('cl-content--collapsible') || !this.inner) {
        return;
      }

      this.collapsedHeight = parseFloat(getComputedStyle(this.content).getPropertyValue('--cl-collapsed-height')) || 220;
      this.expanded = false;

      this.onToggleClick = this.onToggleClick.bind(this);
      this.onResize = this.onResize.bind(this);

      this.evaluate();

      if (this.toggle) this.toggle.addEventListener('click', this.onToggleClick);
      window.addEventListener('resize', this.onResize);
    }

    evaluate() {
      const fullHeight = this.inner.scrollHeight;

      if (fullHeight <= this.collapsedHeight + BUFFER) {
        // Content already fits — no need to collapse or show a toggle at all
        this.content.removeAttribute('data-cl-collapsed');
        if (this.toggle) this.toggle.hidden = true;
        return;
      }

      if (this.toggle) this.toggle.hidden = false;

      if (!this.expanded) {
        this.content.setAttribute('data-cl-collapsed', '');
      }
    }

    onToggleClick() {
      this.expanded = !this.expanded;

      if (this.expanded) {
        this.content.removeAttribute('data-cl-collapsed');
      } else {
        this.content.setAttribute('data-cl-collapsed', '');
        // Scroll the block back into view if the user collapsed while scrolled past it
        const rect = this.section.getBoundingClientRect();
        if (rect.top < 0) {
          this.section.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }

      this.toggle.setAttribute('aria-expanded', String(this.expanded));
      if (this.toggleLabel) {
        this.toggleLabel.textContent = this.expanded
          ? this.toggle.dataset.lessLabel
          : this.toggle.dataset.moreLabel;
      }
    }

    onResize() {
      if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => this.evaluate());
    }
  }

  function init() {
    document.querySelectorAll(SELECTOR).forEach((content) => {
      if (content.__collectionsList) return;
      content.__collectionsList = new CollectionsList(content);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (event) => {
    const content = event.target.querySelector(SELECTOR);
    if (content) content.__collectionsList = new CollectionsList(content);
  });
})();