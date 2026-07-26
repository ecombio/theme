/* assets/collection-feed.js
   Behavior for snippets/collection-feed.liquid. Fully self-contained:
   everything it queries (#collection-feed and its descendants) lives
   inside that snippet's own markup.

   Coordinates with collection-toolbar.js ONLY through:
     - a `collection:tabchange` CustomEvent on `document`
     - the `?tab=` URL param, read independently on `popstate`
   It never queries into the toolbar's DOM, so this snippet can be
   reordered, reused elsewhere, or dropped without breaking the
   toolbar (it'll just have no panels to control).

   Also owns the sub-collections carousel, since that markup
   (rendered via snippets/sub-collection.liquid) only ever appears
   inside this feed's product panel. */

(function () {
  'use strict';

  var feed = document.getElementById('collection-feed');
  if (!feed) return;

  /* ══════════════════════════════════════════════════════════
     PANEL VISIBILITY
  ══════════════════════════════════════════════════════════ */
  var panels = feed.querySelectorAll('[data-panel]');

  function showPanel(key) {
    panels.forEach(function (p) {
      if (p.dataset.panel === key) {
        p.removeAttribute('hidden');
      } else {
        p.setAttribute('hidden', '');
      }
    });
  }

  document.addEventListener('collection:tabchange', function (e) {
    showPanel(e.detail.tab);
  });

  window.addEventListener('popstate', function () {
    var key = new URL(window.location.href).searchParams.get('tab') || 'products';
    showPanel(key);
  });

  /* ══════════════════════════════════════════════════════════
     SUB-COLLECTIONS CAROUSEL
     Prev/next buttons scroll the track by ~3 card widths.
  ══════════════════════════════════════════════════════════ */
  feed.querySelectorAll('[data-sub-collections]').forEach(function (carousel) {
    var track = carousel.querySelector('[data-sub-collections-track]');
    var prev  = carousel.querySelector('[data-sub-collections-prev]');
    var next  = carousel.querySelector('[data-sub-collections-next]');
    if (!track) return;

    function updateNavState() {
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled =
        track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    }

    function scrollByAmount(dir) {
      var cardWidth = track.firstElementChild
        ? track.firstElementChild.getBoundingClientRect().width
        : 120;
      track.scrollBy({ left: dir * (cardWidth * 3 + 32), behavior: 'smooth' });
    }

    if (prev) prev.addEventListener('click', function () { scrollByAmount(-1); });
    if (next) next.addEventListener('click', function () { scrollByAmount(1); });
    track.addEventListener('scroll', updateNavState);
    updateNavState();
  });

})();
