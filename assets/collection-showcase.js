/**
 * collection-showcase.js
 * Handles tab switching between products, articles, and pages panels.
 * Pure CSS show/hide — no fetch, no page reload.
 */

(() => {
  const TAB_SEL      = '.collection-toolbar__tab';
  const TABS_NAV_SEL = '.collection-toolbar__tabs';
  const PANEL_SEL    = '.collection-showcase__panel';

  function init() {
    const tabs   = document.querySelectorAll(TAB_SEL);
    const panels = document.querySelectorAll(PANEL_SEL);

    if (!tabs.length || !panels.length) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', e => {
        e.preventDefault();

        const target = tab.dataset.tab;
        if (!target) return;

        // Already active — do nothing
        if (tab.getAttribute('aria-selected') === 'true') return;

        // Switch panels
        panels.forEach(panel => {
          panel.classList.toggle('is-active', panel.dataset.tab === target);
        });

        // Switch active tab
        tabs.forEach(t => {
          const isActive = t === tab;
          t.classList.toggle('collection-toolbar__tab--active', isActive);
          t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        // Update URL without reload
        const url = new URL(window.location.href);
        url.searchParams.set('tab', target);
        history.pushState({ tab: target }, '', url.toString());
      });
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      const params = new URLSearchParams(window.location.search);
      const target = params.get('tab') || 'products';

      panels.forEach(panel => {
        panel.classList.toggle('is-active', panel.dataset.tab === target);
      });

      tabs.forEach(tab => {
        const isActive = tab.dataset.tab === target;
        tab.classList.toggle('collection-toolbar__tab--active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
