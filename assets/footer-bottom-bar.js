/**
 * footer-bottom-bar.js
 *
 * Responsibilities
 * ─────────────────
 * 1. Dynamic copyright year  — keeps [data-fbb-year] current client-side
 *    (guards against stale Liquid output in long-cached pages).
 * 2. Locale selector toggle  — ARIA-compliant open/close/keyboard nav.
 * 3. Click-outside dismiss   — closes the locale list on outside click.
 * 4. Keyboard navigation     — Arrow keys move through locale options;
 *    Escape closes the list.
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. Dynamic copyright year
   * ------------------------------------------------------------------ */
  function syncCopyrightYear() {
    const yearEl = document.querySelector('[data-fbb-year]');
    if (!yearEl) return;

    const currentYear = String(new Date().getFullYear());
    if (yearEl.textContent.trim() !== currentYear) {
      yearEl.textContent = currentYear;
    }
  }

  /* ------------------------------------------------------------------ *
   * 2. Locale selector
   * ------------------------------------------------------------------ */
  function initLocaleSelector() {
    const wrappers = document.querySelectorAll('[data-fbb-locale]');
    if (!wrappers.length) return;

    wrappers.forEach(function (wrapper) {
      const trigger = wrapper.querySelector('[data-fbb-locale-trigger]');
      const list    = wrapper.querySelector('[data-fbb-locale-list]');

      if (!trigger || !list) return;

      /* ── helpers ── */
      function getOptions() {
        return Array.from(list.querySelectorAll('.fbb__locale-btn'));
      }

      function open() {
        list.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        // Focus first (or active) option
        const active = list.querySelector('.fbb__locale-btn--active') || getOptions()[0];
        if (active) active.focus();
      }

      function close(returnFocus) {
        list.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (returnFocus) trigger.focus();
      }

      function toggle() {
        list.hidden ? open() : close(false);
      }

      /* ── trigger click ── */
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        toggle();
      });

      /* ── keyboard on trigger ── */
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          open();
        }
        if (e.key === 'Escape') {
          close(true);
        }
      });

      /* ── keyboard inside list ── */
      list.addEventListener('keydown', function (e) {
        const options = getOptions();
        const focused = document.activeElement;
        const idx     = options.indexOf(focused);

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            if (idx < options.length - 1) options[idx + 1].focus();
            break;

          case 'ArrowUp':
            e.preventDefault();
            if (idx > 0) {
              options[idx - 1].focus();
            } else {
              close(true);
            }
            break;

          case 'Escape':
            e.preventDefault();
            close(true);
            break;

          case 'Tab':
            close(false);
            break;

          default:
            break;
        }
      });

      /* ── click-outside dismiss ── */
      document.addEventListener('click', function (e) {
        if (!wrapper.contains(e.target)) {
          close(false);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 3. Init
   * ------------------------------------------------------------------ */
  function init() {
    syncCopyrightYear();
    initLocaleSelector();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
