(function () {
  'use strict';

  const PADDING = 16;

  function clampPanel(panel) {
    // Measure first, in the panel's *current* (already-visible-via-CSS-hover)
    // position, before touching any inline styles. Mutating left/right/transform
    // unconditionally on every mouseenter fights the CSS :hover transition and
    // can cause the panel to flicker or appear to vanish immediately after opening.
    requestAnimationFrame(() => {
      const rect = panel.getBoundingClientRect();
      const vw   = document.documentElement.clientWidth;

      const overflowsRight = rect.right > vw - PADDING;
      const overflowsLeft  = rect.left  < PADDING;

      if (!overflowsRight && !overflowsLeft) {
        // Already fits — leave the default centered CSS transform alone.
        return;
      }

      if (overflowsRight) {
        panel.style.transform = 'none';
        panel.style.left      = 'auto';
        panel.style.right     = PADDING + 'px';
      } else if (overflowsLeft) {
        panel.style.transform = 'none';
        panel.style.left      = PADDING + 'px';
        panel.style.right     = 'auto';
      }
    });
  }

  function resetPanel(panel) {
    // Defer so the browser can re-evaluate :hover state first.
    // If the cursor moved onto the panel itself (crossing the ::before bridge)
    // or is still over the parent item, the CSS :hover rule keeps it open —
    // don't wipe the inline position overrides or the panel will jump/vanish.
    requestAnimationFrame(() => {
      const stillActive =
        panel.matches(':hover') ||
        panel.closest(
          '.menu-bar__item--has-mega:hover, .menu-bar__item--has-dropdown:hover'
        );

      if (!stillActive) {
        panel.style.left      = '';
        panel.style.right     = '';
        panel.style.transform = '';
      }
    });
  }

  function initMenuClamping() {
    document.querySelectorAll(
      '.menu-bar__item--has-mega, .menu-bar__item--has-dropdown'
    ).forEach(item => {
      const panel = item.querySelector(':scope > .mega-menu, :scope > .dropdown');
      if (!panel) return;

      item.addEventListener('mouseenter', () => clampPanel(panel));
      item.addEventListener('mouseleave', () => resetPanel(panel));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenuClamping);
  } else {
    initMenuClamping();
  }
})();