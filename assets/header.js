/**
 * header.js
 *
 * Owns ROW 1 (countdown timer) and ROW 2 (language switcher).
 * ROW 4 dropdown and mega menu logic lives in assets/header-menu.js.
 *
 * Loaded via theme.liquid with `defer`.
 */

(function () {
  'use strict';


  // ── 1. COUNTDOWN TIMER ────────────────────────────────────────────────────
  //
  // Reads data-end-time from the timer element written by Liquid:
  //   <span class="header__promo-timer" data-end-time="{{ section.settings.sale_end_time }}">

  const timer = document.querySelector('.header__promo-timer[data-end-time]');

  if (timer) {
    const endTime = new Date(timer.dataset.endTime).getTime();
    const units   = timer.querySelectorAll('.header__promo-timer-unit');

    function pad(n) {
      return String(n).padStart(2, '0');
    }

    function renderTimer() {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));

      if (remaining <= 0) {
        timer.textContent = 'Sale ended';
        clearInterval(interval);
        return;
      }

      if (units[0]) units[0].textContent = `${pad(Math.floor(remaining / 86400))}D`;
      if (units[1]) units[1].textContent = `${pad(Math.floor((remaining % 86400) / 3600))}H`;
      if (units[2]) units[2].textContent = `${pad(Math.floor((remaining % 3600) / 60))}M`;
      if (units[3]) units[3].textContent = `${pad(remaining % 60)}S`;
    }

    renderTimer();
    const interval = setInterval(renderTimer, 1000);
  }


  // ── 2. LANGUAGE SWITCHER ──────────────────────────────────────────────────
  //
  // Toggles the lang dropdown. Selecting an option submits the Shopify
  // localization form — no JS redirect needed.

  const langBtn  = document.querySelector('.header__lang-switcher');
  const langList = document.getElementById('header-lang-list');

  if (langBtn && langList) {
    langBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = langBtn.getAttribute('aria-expanded') === 'true';
      langBtn.setAttribute('aria-expanded', String(!isOpen));
      langList.hidden = isOpen;
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.header__lang-form')) {
        langBtn.setAttribute('aria-expanded', 'false');
        langList.hidden = true;
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && langBtn.getAttribute('aria-expanded') === 'true') {
        langBtn.setAttribute('aria-expanded', 'false');
        langList.hidden = true;
        langBtn.focus();
      }
    });
  }

})();