(function () {
  'use strict';

  const PADDING = 16;

  function clampPanel(panel) {
    panel.style.left      = '';
    panel.style.right     = '';
    panel.style.transform = 'translateX(-50%)';

    requestAnimationFrame(() => {
      const rect = panel.getBoundingClientRect();
      const vw   = document.documentElement.clientWidth;

      if (rect.right > vw - PADDING) {
        panel.style.transform = 'none';
        panel.style.left      = 'auto';
        panel.style.right     = '0';
      } else if (rect.left < PADDING) {
        panel.style.transform = 'none';
        panel.style.left      = '0';
        panel.style.right     = 'auto';
      }
    });
  }

  function initMenuClamping() {
    const items = document.querySelectorAll(
      '.menu-bar__item--has-mega, .menu-bar__item--has-dropdown'
    );

    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        const panel = item.querySelector(':scope > .mega-menu, :scope > .dropdown');
        if (panel) clampPanel(panel);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenuClamping);
  } else {
    initMenuClamping();
  }
})();