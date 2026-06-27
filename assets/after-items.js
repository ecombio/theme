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
})();