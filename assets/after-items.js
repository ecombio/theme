/* ============================================
   after-items.js
   Progressive enhancement for .after-items content.
   ============================================ */

(function () {
  const container = document.querySelector('.after-items');
  if (!container) return;

  // Lazy-load images
  container.querySelectorAll('img').forEach((img) => {
    if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
  });

  // External links → new tab
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