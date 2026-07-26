(function () {
  'use strict';

  var modal = document.querySelector('[data-video-modal]');
  if (!modal) return;

  var content = modal.querySelector('[data-video-modal-content]');
  var productPane = modal.querySelector('[data-video-modal-product]');
  var inner = modal.querySelector('.video-modal__inner');
  var closeEls = modal.querySelectorAll('[data-video-modal-close]');
  var lastTrigger = null;

  function buildEmbed(detail) {
    if (detail.type === 'youtube' && detail.id) {
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube.com/embed/' + detail.id + '?autoplay=1&rel=0';
      iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      iframe.allowFullscreen = true;
      iframe.title = 'YouTube video player';
      return iframe;
    }

    if (detail.type === 'vimeo' && detail.id) {
      var vIframe = document.createElement('iframe');
      vIframe.src = 'https://player.vimeo.com/video/' + detail.id + '?autoplay=1';
      vIframe.allow = 'autoplay; fullscreen; picture-in-picture';
      vIframe.allowFullscreen = true;
      vIframe.title = 'Vimeo video player';
      return vIframe;
    }

    if (detail.type === 'file' && detail.fileUrl) {
      var video = document.createElement('video');
      video.src = detail.fileUrl;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;

      // We don't know the real ratio until the browser reads the file, so
      // size the modal box once metadata is available instead of assuming 16:9.
      // Runs in both single and split layout — split layout now sizes its
      // media pane off the real ratio too, so portrait uploads (9:16 reels)
      // don't get pillarboxed inside a landscape-shaped box.
      video.addEventListener('loadedmetadata', function () {
        if (video.videoWidth && video.videoHeight) {
          applyRatio(video.videoWidth, video.videoHeight);
        }
      });

      return video;
    }

    return null;
  }

  function applyRatio(width, height) {
    var isPortrait = height > width;
    modal.setAttribute('data-orientation', isPortrait ? 'portrait' : 'landscape');
    inner.style.setProperty('--vm-ratio', width + ' / ' + height);
  }

  // Thumbnail click-to-swap for the inline product panel (see
  // video-card.liquid / video-card.css for the markup + styles). The panel
  // gets cloned fresh into productPane every time the modal opens, so this
  // listens on productPane itself (a fixed node) rather than the thumbnails
  // directly, meaning it doesn't need to be re-bound after each clone.
  if (productPane) {
    productPane.addEventListener('click', function (event) {
      var thumb = event.target.closest('[data-modal-product-thumb]');
      if (!thumb) return;

      var mainImage = productPane.querySelector('[data-modal-product-main-image]');
      if (mainImage) mainImage.src = thumb.getAttribute('data-full-src');

      productPane.querySelectorAll('[data-modal-product-thumb]').forEach(function (t) {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      thumb.classList.add('is-active');
      thumb.setAttribute('aria-selected', 'true');
    });
  }

  function open(detail) {
    var embed = buildEmbed(detail);
    if (!embed) return;

    content.innerHTML = '';
    content.appendChild(embed);

    // Reset to the 16:9 default; buildEmbed's loadedmetadata handler will
    // override this for uploaded files once the real ratio is known.
    modal.setAttribute('data-orientation', 'landscape');
    inner.style.removeProperty('--vm-ratio');

    if (detail.hasProduct && detail.productHTML) {
      productPane.innerHTML = detail.productHTML;
      productPane.hidden = false;
      modal.setAttribute('data-layout', 'split');
    } else {
      productPane.hidden = true;
      productPane.innerHTML = '';
      modal.setAttribute('data-layout', 'single');
    }

    lastTrigger = detail.triggerEl || null;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    var closeBtn = modal.querySelector('.video-modal__close');
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    if (modal.hidden) return;

    modal.hidden = true;
    document.body.style.overflow = '';
    content.innerHTML = ''; // stops playback by removing the iframe/video
    productPane.innerHTML = '';
    productPane.hidden = true;

    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      lastTrigger.focus();
    }
    lastTrigger = null;
  }

  document.addEventListener('video-card:play', function (event) {
    open(event.detail);
  });

  closeEls.forEach(function (el) {
    el.addEventListener('click', close);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !modal.hidden) {
      close();
    }
  });
})();
