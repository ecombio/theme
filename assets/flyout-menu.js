(function () {
  'use strict';

  function initFlyoutMenus() {
    const flyoutItems = document.querySelectorAll('.menu-bar__item--has-flyout');

    flyoutItems.forEach(item => {
      const sidebarItems = item.querySelectorAll('.flyout-menu__sidebar-item');
      const panels = item.querySelectorAll('.flyout-menu__panel');

      function activateIndex(index) {
        sidebarItems.forEach(s => s.classList.remove('is-active'));
        panels.forEach(p => p.classList.remove('is-active'));
        if (sidebarItems[index]) sidebarItems[index].classList.add('is-active');
        if (panels[index]) panels[index].classList.add('is-active');
      }

      sidebarItems.forEach(sidebarItem => {
        sidebarItem.addEventListener('mouseenter', () => {
          const index = parseInt(sidebarItem.dataset.flyoutIndex, 10);
          activateIndex(index);
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFlyoutMenus);
  } else {
    initFlyoutMenus();
  }
})();