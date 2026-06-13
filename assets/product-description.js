(function () {
  'use strict';

  function initDescPanel() {
    var trigger  = document.getElementById('PdTrigger');
    var panel    = document.getElementById('PdPanel');
    var overlay  = document.getElementById('PdOverlay');
    var closeBtn = document.getElementById('PdClose');

    if (!trigger || !panel || !overlay || !closeBtn) return;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      overlay.classList.add('is-visible');
      requestAnimationFrame(function () {
        overlay.classList.add('is-open');
        panel.classList.add('is-open');
      });
      panel.setAttribute('aria-hidden', 'false');
      overlay.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      setTimeout(function () { panel.focus(); }, 50);
    }

    function close() {
      panel.classList.remove('is-open');
      overlay.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      setTimeout(function () { overlay.classList.remove('is-visible'); }, 300);
      if (lastFocus) lastFocus.focus();
    }

    trigger.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
    });

    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var focusable = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      var first = focusable[0];
      var last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDescPanel);
  } else {
    initDescPanel();
  }

})();