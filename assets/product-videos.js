(() => {
  'use strict';

  function updateArrows(track, prevBtn, nextBtn) {
    if (!prevBtn || !nextBtn) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    prevBtn.disabled = track.scrollLeft <= 1;
    nextBtn.disabled = track.scrollLeft >= maxScroll - 1;
  }

  function scrollByItems(track) {
    const firstItem = track.querySelector('[data-video-item]');
    if (!firstItem) return track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    return firstItem.getBoundingClientRect().width + gap;
  }

  function initInstance(root) {
    const track = root.querySelector('[data-video-track]');
    const prevBtn = root.querySelector('[data-video-prev]');
    const nextBtn = root.querySelector('[data-video-next]');
    if (!track) return;

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        track.scrollBy({ left: -scrollByItems(track), behavior: 'smooth' });
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        track.scrollBy({ left: scrollByItems(track), behavior: 'smooth' });
      });
    }

    let scrollTimeout;
    track.addEventListener('scroll', () => {
      window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => updateArrows(track, prevBtn, nextBtn), 50);
    });

    window.addEventListener('resize', () => updateArrows(track, prevBtn, nextBtn));

    updateArrows(track, prevBtn, nextBtn);
  }

  function init() {
    document
      .querySelectorAll('[data-product-videos]')
      .forEach(initInstance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();