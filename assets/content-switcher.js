/**
 * content-switcher.js
 * Intercepts tab link clicks within .collection-toolbar__tabs,
 * fetches the target URL, swaps .collection-showcase and the
 * result count without a full page reload, and updates the
 * browser history via the History API.
 *
 * Falls back to full navigation on fetch failure.
 * Aborts in-flight requests if the user clicks again before
 * the previous fetch resolves.
 */

(() => {
  const SHOWCASE_SEL = '.collection-showcase';
  const TAB_SEL      = '.collection-toolbar__tab';
  const TABS_NAV_SEL = '.collection-toolbar__tabs';
  const COUNT_SEL    = '.collection-toolbar__count';

  let controller = null;

  // ── Swap showcase + count from a fetched document ──────────────────────
  async function navigateTab(url, tabEl) {
    if (controller) controller.abort();
    controller = new AbortController();

    const showcase = document.querySelector(SHOWCASE_SEL);
    if (!showcase) return;

    showcase.setAttribute('aria-busy', 'true');
    showcase.style.opacity = '0.5';
    showcase.style.transition = 'opacity 0.15s ease';

    try {
      const res = await fetch(url, {
        signal:  controller.signal,
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html   = await res.text();
      const parser = new DOMParser();
      const doc    = parser.parseFromString(html, 'text/html');

      // Swap showcase content
      const incoming = doc.querySelector(SHOWCASE_SEL);
      if (incoming) showcase.innerHTML = incoming.innerHTML;

      // Swap result count
      const incomingCount = doc.querySelector(COUNT_SEL);
      const currentCount  = document.querySelector(COUNT_SEL);
      if (incomingCount && currentCount) {
        currentCount.textContent = incomingCount.textContent.trim();
      }

      // Push new URL to history
      history.pushState({ tab: url }, '', url);

      // Update active tab UI
      setActiveTab(tabEl);

    } catch (err) {
      if (err.name !== 'AbortError') {
        // Fetch failed — fall back to full navigation
        window.location.assign(url);
      }
    } finally {
      showcase.removeAttribute('aria-busy');
      showcase.style.opacity = '';
      controller = null;
    }
  }

  // ── Update aria-selected + active class on all tab links ───────────────
  function setActiveTab(activeEl) {
    document.querySelectorAll(TAB_SEL).forEach(tab => {
      const isActive = tab === activeEl;
      tab.classList.toggle('collection-toolbar__tab--active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  // ── Intercept tab link clicks ──────────────────────────────────────────
  document.addEventListener('click', e => {
    const tab = e.target.closest(TAB_SEL);
    if (!tab) return;

    const nav = tab.closest(TABS_NAV_SEL);
    if (!nav) return;

    e.preventDefault();

    const url = tab.getAttribute('href');
    if (!url) return;

    // Already active — do nothing
    if (tab.getAttribute('aria-selected') === 'true') return;

    navigateTab(url, tab);
  });

  // ── Handle browser back / forward ─────────────────────────────────────
  window.addEventListener('popstate', () => {
    const url   = window.location.href;
    const tabEl = document.querySelector(`${TAB_SEL}[href="${url}"]`)
               || document.querySelector(TAB_SEL);
    navigateTab(url, tabEl);
  });

  // ── Sort select — rebuild URL and navigate ─────────────────────────────
  document.addEventListener('change', e => {
    const select = e.target.closest('[data-sort-select]');
    if (!select) return;
    const url = new URL(window.location.href);
    url.searchParams.set('sort_by', select.value);
    window.location.assign(url.toString());
  });

})();