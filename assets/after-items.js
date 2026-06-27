/* ============================================
   after-items.js
   Progressive enhancement for .after-items
   content rendered from a page metafield.
   ============================================ */

(function () {
  const container = document.querySelector('.after-items');
  if (!container) return;

  // ── Lazy-load any images inside the content ──
  container.querySelectorAll('img').forEach((img) => {
    if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
  });

  // ── Open external links in a new tab ──
  container.querySelectorAll('a[href]').forEach((link) => {
    try {
      const url = new URL(link.href, window.location.origin);
      if (url.hostname !== window.location.hostname) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    } catch (_) {}
  });

  // ── Wire up collection-hero "See more" link to first heading ──
  const seeMoreLink = document.querySelector('.collection-hero [data-scroll-target]');
  if (seeMoreLink) {
    const firstHeading = container.querySelector('h2, h3');
    if (firstHeading) {
      if (!firstHeading.id) {
        firstHeading.id = firstHeading.textContent
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }

      // Scroll manually and replaceState so the hash never enters the URL
      seeMoreLink.addEventListener('click', (e) => {
        e.preventDefault();
        firstHeading.scrollIntoView({ behavior: 'smooth' });
        const url = new URL(window.location.href);
        url.hash = '';
        history.replaceState(null, '', url.toString());
      });
    }
  }

})();