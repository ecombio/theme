/**
 * main-search.js — Independent panel loading via Section Rendering API
 */
(function () {
  'use strict';

  const sectionRoot = document.getElementById('main-search');
  if (!sectionRoot) return;

  const sectionId = sectionRoot.dataset.sectionId;
  const page = document.querySelector('[data-search-page]');
  const feed = document.getElementById('search-feed');
  if (!page || !feed || !sectionId) return;

  const tabs = document.querySelectorAll('.tab-switcher__tab[data-type]');
  const populated = new Set();

  function getCurrentType() {
    return page.dataset.activeType || 'product';
  }

  function setActiveType(type) {
    page.dataset.activeType = type;
    tabs.forEach(t => {
      const active = t.dataset.type === type;
      t.classList.toggle('tab-switcher__tab--active', active);
      t.setAttribute('aria-selected', active);
    });

    const p = document.getElementById('panel-products');
    const a = document.getElementById('panel-articles');
    if (p) p.hidden = (type !== 'product');
    if (a) a.hidden = (type !== 'article');
  }

  async function fetchPanel(type, extraParams = '') {
    const url = new URL(window.location.href);
    url.searchParams.set('type', type);
    url.searchParams.set('section_id', sectionId);

    if (extraParams) {
      new URLSearchParams(extraParams).forEach((v, k) => url.searchParams.set(k, v));
    }
    if (type === 'article') url.searchParams.delete('sort_by');

    try {
      const res = await fetch(url.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const newFeed = doc.getElementById('search-feed');

      if (newFeed) {
        feed.innerHTML = newFeed.innerHTML;
        populated.add(type);
        setActiveType(type);
        attachListeners();
      }
    } catch (e) {
      window.location.href = url.toString().replace(`section_id=${sectionId}`, '');
    }
  }

  function attachListeners() {
    // Pagination (event delegation)
    feed.onclick = function (e) {
      const link = e.target.closest('.pagination__link');
      if (!link) return;
      e.preventDefault();
      const type = getCurrentType();
      const params = new URL(link.href).searchParams.toString();
      fetchPanel(type, params);
    };

    // Sort
    const sort = document.querySelector('[data-sort]');
    if (sort) {
      sort.onchange = () => {
        if (getCurrentType() === 'product') {
          fetchPanel('product', `sort_by=${sort.value}`);
        }
      };
    }
  }

  // Tab clicks
  tabs.forEach(tab => {
    tab.onclick = function (e) {
      e.preventDefault();
      const type = tab.dataset.type;
      if (type === getCurrentType()) return;

      if (populated.has(type)) {
        setActiveType(type);
        const url = new URL(window.location.href);
        url.searchParams.set('type', type);
        history.pushState({}, '', url);
      } else {
        fetchPanel(type);
      }
    };
  });

  // Mobile sort sheet + backdrop (simplified)
  const mobileBtn = document.querySelector('[data-mobile-sort-toggle]');
  const backdrop = document.querySelector('.search-mobile-backdrop');
  if (mobileBtn && backdrop) {
    mobileBtn.onclick = () => {
      // You can expand this with the full sheet logic from your collection if needed
      alert('Mobile sort sheet would open here (copy from your collection version)');
    };
  }

  // Init
  function init() {
    populated.add(getCurrentType());
    attachListeners();

    window.addEventListener('popstate', () => {
      const type = new URL(window.location.href).searchParams.get('type') || 'product';
      if (populated.has(type)) setActiveType(type);
      else fetchPanel(type);
    });
  }

  init();
})();