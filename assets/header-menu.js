/**
 * header-menu.js
 *
 * Handles all interactivity for the block-driven menu bar (ROW 4).
 *
 * RESPONSIBILITIES:
 *   1. --menu-bottom  — pins mega panels flush below the header
 *   2. Linklist dropdowns — hover (desktop) + click, aria-expanded, close-on-outside
 *   3. Mega panels — same hover + click pattern + overlay
 *   4. Escape key and outside click close everything
 *   5. Focus trap inside open mega panels
 *
 * HOVER BEHAVIOUR:
 *   On pointer-capable devices (desktop), panels open on mouseenter and close
 *   on mouseleave with a short delay so the cursor can move into the panel.
 *   Click still works as a fallback and for touch devices.
 *   Touch devices (no fine pointer) use click-only — no hover intent delay.
 *
 * DATA ATTRIBUTES (must match snippets):
 *   [data-menu-dropdown]    wrapper for any item that has a panel
 *   [data-menu-toggle]      the trigger <button> inside that wrapper
 *   .header__menu-dropdown  linklist <ul> panel
 *   .header__mega-panel     mega menu <div> panel
 *
 * Loaded via theme.liquid with `defer`.
 */

(function () {
  'use strict';

  // Delay (ms) before closing on mouseleave — gives the cursor time to move
  // from the trigger into the panel without the panel vanishing.
  var HOVER_CLOSE_DELAY = 150;


  // ── 1. --menu-bottom ──────────────────────────────────────────────────────

  const header = document.querySelector('[data-header]');

  function setMenuBottom() {
    if (!header) return;
    const bottom = header.getBoundingClientRect().bottom + window.scrollY;
    document.documentElement.style.setProperty('--menu-bottom', `${Math.round(bottom)}px`);
  }

  setMenuBottom();
  window.addEventListener('resize', setMenuBottom, { passive: true });

  const promoEl = document.querySelector('.header__promo');
  if (promoEl && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(setMenuBottom).observe(promoEl);
  }


  // ── 2. OVERLAY ────────────────────────────────────────────────────────────

  let overlay = null;

  function getOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'header__mega-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeAll);
    return overlay;
  }

  function showOverlay() { getOverlay().classList.add('header__mega-overlay--visible'); }
  function hideOverlay() { if (overlay) overlay.classList.remove('header__mega-overlay--visible'); }


  // ── 3. OPEN / CLOSE ───────────────────────────────────────────────────────

  function openItem(btn, panel) {
    btn.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    if (panel.classList.contains('header__mega-panel')) {
      setMenuBottom();
      showOverlay();
    }
  }

  function closeItem(btn, panel) {
    btn.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    if (panel.classList.contains('header__mega-panel')) {
      hideOverlay();
    }
  }

  function closeAll(except) {
    document.querySelectorAll('[data-menu-dropdown]').forEach(function (wrapper) {
      if (wrapper === except) return;
      const btn   = wrapper.querySelector('[data-menu-toggle]');
      const panel = wrapper.querySelector('.header__menu-dropdown, .header__mega-panel');
      if (btn && panel && !panel.hidden) closeItem(btn, panel);
    });
  }


  // ── 4. WIRE UP TOGGLES ────────────────────────────────────────────────────
  //
  // canHover: true when the device supports a fine pointer (mouse).
  // On touch-only devices we skip mouseenter/mouseleave entirely.

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  document.querySelectorAll('[data-menu-dropdown]').forEach(function (wrapper) {
    const btn   = wrapper.querySelector('[data-menu-toggle]');
    const panel = wrapper.querySelector('.header__menu-dropdown, .header__mega-panel');
    if (!btn || !panel) return;

    // ── Click (works on all devices) ──
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      closeAll(wrapper);
      isOpen ? closeItem(btn, panel) : openItem(btn, panel);
    });

    if (!canHover) return;

    // ── Hover (desktop only) ──────────────────────────────────────────────
    // We keep a shared close timer per wrapper so entering the panel itself
    // cancels the close that was scheduled when leaving the trigger.

    let closeTimer = null;

    function scheduleClose() {
      closeTimer = setTimeout(function () {
        if (btn.getAttribute('aria-expanded') === 'true') {
          closeAll(null);
        }
      }, HOVER_CLOSE_DELAY);
    }

    function cancelClose() {
      clearTimeout(closeTimer);
    }

    // Trigger: open on enter, schedule close on leave
    wrapper.addEventListener('mouseenter', function () {
      cancelClose();
      closeAll(wrapper);
      openItem(btn, panel);
    });

    wrapper.addEventListener('mouseleave', function () {
      scheduleClose();
    });

    // Panel: cancel close when cursor moves into it
    panel.addEventListener('mouseenter', cancelClose);
    panel.addEventListener('mouseleave', scheduleClose);
  });


  // ── 5. CLOSE ON OUTSIDE CLICK ─────────────────────────────────────────────

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.header__menu')) closeAll(null);
  });


  // ── 6. CLOSE ON ESCAPE ────────────────────────────────────────────────────

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const openBtn = document.querySelector('[data-menu-toggle][aria-expanded="true"]');
    closeAll(null);
    if (openBtn) openBtn.focus();
  });


  // ── 7. FOCUS TRAP INSIDE MEGA PANELS ─────────────────────────────────────

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    const openPanel = document.querySelector('.header__mega-panel:not([hidden])');
    if (!openPanel) return;

    const focusable = Array.from(
      openPanel.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
      return !el.disabled && el.offsetParent !== null;
    });

    if (!focusable.length) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      const trigger = openPanel.closest('[data-menu-dropdown]')
        ?.querySelector('[data-menu-toggle]');
      if (trigger) trigger.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

})();