(() => {
  'use strict';

  function initInstance(root) {
    const tabs   = root.querySelectorAll('[data-tab-target]');
    const panels = root.querySelectorAll('[data-tab-panel]');

    // Only tabs that actually rendered end up in this list, so a hash
    // for a tab this product doesn't have (e.g. #warranty on a product
    // with no warranty content) is simply ignored below.
    const validTargets = Array.from(tabs).map((tab) => tab.getAttribute('data-tab-target'));

    function activate(name) {
      tabs.forEach((tab) => {
        const isActive = tab.getAttribute('data-tab-target') === name;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
      });
      panels.forEach((panel) => {
        panel.hidden = panel.getAttribute('data-tab-panel') !== name;
      });
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        activate(tab.getAttribute('data-tab-target'));
      });
    });

    // Generalized from a hardcoded #reviews check — now handles a
    // direct link, a bookmark, or a click on any jump link elsewhere
    // on the page pointing at #description / #shipping / #refund /
    // #warranty / #reviews.
    function checkHash() {
      const hash = window.location.hash.replace('#', '');
      if (validTargets.includes(hash)) {
        activate(hash);
      }
    }

    window.addEventListener('hashchange', checkHash);
    checkHash();
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