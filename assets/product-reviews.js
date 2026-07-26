(function () {
  'use strict';

  var READY_CLASS   = 'jdgm--done-setup-widget';
  var TIMEOUT_MS    = 8000;

  function initSection(wrapperEl) {
    var widgetEl = wrapperEl.querySelector('#judgeme_product_reviews');
    var innerWrap = wrapperEl.querySelector('[data-revs-widget-wrapper]');

    if (!widgetEl || !innerWrap) {
      wrapperEl.hidden = true;
      return;
    }

    var settled = false;

    function markLoaded() {
      if (settled) return;
      settled = true;
      innerWrap.setAttribute('data-revs-loaded', 'true');
      wrapperEl.hidden = false;
      observer.disconnect();
      clearTimeout(timeoutId);
    }

    function markFailed() {
      if (settled) return;
      settled = true;
      wrapperEl.hidden = true;
      observer.disconnect();
    }

    if (widgetEl.classList.contains(READY_CLASS)) {
      markLoaded();
      return;
    }

    var observer = new MutationObserver(function () {
      if (widgetEl.classList.contains(READY_CLASS)) {
        markLoaded();
      }
    });

    observer.observe(widgetEl, { attributes: true, attributeFilter: ['class'] });

    var timeoutId = setTimeout(function () {
      markFailed();
    }, TIMEOUT_MS);
  }

  function init() {
    document.querySelectorAll('[data-revs-section]').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (e) {
    var section = e.target.querySelector('[data-revs-section]');
    if (section) initSection(section);
  });
})();