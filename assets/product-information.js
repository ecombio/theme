(() => {
  'use strict';

  function initInstance(root) {
    const tabs   = root.querySelectorAll('[data-tab-target]');
    const panels = root.querySelectorAll('[data-tab-panel]');

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