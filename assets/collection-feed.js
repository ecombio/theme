/* ============================================
   collection-feed.js
   Tab switching and browser history for the collection feed.
   ============================================ */

(function () {
  'use strict';

  var page = document.querySelector('[data-collection-page]');
  if (!page) return;

  var tabs   = page.querySelectorAll('[data-tab]');
  var panels = page.querySelectorAll('[data-panel]');

  if (!tabs.length || !panels.length) return;

  /* ── Core activate ────────────────────────────────────────── */
  function activateTab(key, push) {
    tabs.forEach(function (t) {
      var on = t.dataset.tab === key;
      t.classList.toggle('tab-switcher__tab--active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
    });

    panels.forEach(function (p) {
      if (p.dataset.panel === key) {
        p.removeAttribute('hidden');
      } else {
        p.setAttribute('hidden', '');
      }
    });

    page.dataset.activeTab = key;

    if (push) {
      var url = new URL(window.location.href);
      url.searchParams.set('tab', key);
      url.hash = '';
      history.pushState({ tab: key }, '', url.toString());
    }
  }

  /* ── Tab clicks ───────────────────────────────────────────── */
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      if (tab.dataset.tab !== page.dataset.activeTab) {
        activateTab(tab.dataset.tab, true);
      }
    });

    /* Arrow key navigation (ARIA tablist pattern) */
    tab.addEventListener('keydown', function (e) {
      var next;
      if (e.key === 'ArrowRight') next = tabs[i + 1] || tabs[0];
      if (e.key === 'ArrowLeft')  next = tabs[i - 1] || tabs[tabs.length - 1];
      if (next) {
        next.focus();
        next.click();
      }
    });
  });

  /* ── Popstate (back/forward) ──────────────────────────────── */
  window.addEventListener('popstate', function (e) {
    var key = (e.state && e.state.tab)
      ? e.state.tab
      : new URL(window.location.href).searchParams.get('tab') || 'products';
    activateTab(key, false);
  });

})();