/* ==========================================================================
   PRODUCT INFORMATION
   assets/product-information.js

   Pairs with sections/product-information.liquid and product-information.css.

   Replaces the old tab click-to-activate/hide-panel behavior (there are no
   more panels to hide — every section renders inline as a collapsible
   <details> that's open by default). This script does two things:

     1. Force-opens a section's <details> before the browser's native
        anchor scroll happens, in case a visitor had collapsed it.
     2. Highlights whichever jump link matches the section currently in
        view, via IntersectionObserver (a scrollspy), since there's no
        single "active panel" anymore to drive that state from.
   ========================================================================== */

(() => {
  'use strict';

  function initInstance(root) {
    const links = root.querySelectorAll('[data-jumplink]');
    const sectionsRoot = root.querySelector('[data-sections]');
    if (!sectionsRoot) return;

    const sections = sectionsRoot.querySelectorAll('[data-section]');
    const linkByTarget = new Map();
    links.forEach((link) => linkByTarget.set(link.getAttribute('data-jumplink'), link));

    function setActive(id) {
      links.forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('data-jumplink') === id);
      });
    }

    // Force the target section open before the browser scrolls to it,
    // in case the visitor had collapsed it.
    links.forEach((link) => {
      link.addEventListener('click', () => {
        const id = link.getAttribute('data-jumplink');
        const target = document.getElementById(id);
        if (target && target.tagName === 'DETAILS' && !target.open) {
          target.open = true;
        }
      });
    });

    const headerHeight = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--header-group-height') || '68',
      10
    );

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top of the viewport that's currently intersecting.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActive(visible[0].target.getAttribute('data-section'));
        }
      },
      {
        // Trigger when a section is roughly in the "reading band" below the sticky bar.
        rootMargin: `-${headerHeight + 60}px 0px -70% 0px`,
        threshold: 0
      }
    );

    sections.forEach((section) => observer.observe(section));

    // Sync active state on load if the URL already has a hash.
    const hash = window.location.hash.replace('#', '');
    if (hash && linkByTarget.has(hash)) {
      setActive(hash);
    } else if (sections.length > 0) {
      setActive(sections[0].getAttribute('data-section'));
    }
  }

  function init() {
    document
      .querySelectorAll('[data-product-information]')
      .forEach(initInstance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();