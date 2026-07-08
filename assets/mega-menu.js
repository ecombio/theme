(function () {
  function closeAll(except) {
    document.querySelectorAll('[data-mega-menu-trigger][aria-expanded="true"]').forEach(function (trigger) {
      if (trigger === except) return;
      trigger.setAttribute('aria-expanded', 'false');
      var panel = trigger.parentElement.querySelector('[data-mega-menu-panel]');
      if (panel) panel.hidden = true;
    });
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-mega-menu-trigger]');

    if (trigger) {
      var panel = trigger.parentElement.querySelector('[data-mega-menu-panel]');
      var isOpen = trigger.getAttribute('aria-expanded') === 'true';
      closeAll(isOpen ? null : trigger);
      trigger.setAttribute('aria-expanded', String(!isOpen));
      if (panel) panel.hidden = isOpen;
      return;
    }

    if (!event.target.closest('.mega-menu')) {
      closeAll();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeAll();
  });
})();