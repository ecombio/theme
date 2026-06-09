/**
 * collection-filters.js
 * HYPER Theme — handles filter sidebar, sort, view-switching, price range
 */

(function () {
  'use strict';

  /* ---- Filter form auto-submit on checkbox change ---- */
  document.querySelectorAll('.facets__checkbox').forEach((input) => {
    input.addEventListener('change', () => {
      input.closest('form') && input.closest('form').submit();
    });
  });

  /* ---- Price range dual slider ---- */
  const priceForm = document.querySelector('[data-price-range-form]');
  if (priceForm) {
    const rangeMin    = priceForm.querySelector('[id$="-GTE"]');
    const rangeMax    = priceForm.querySelector('[id$="-LTE"]');
    const inputMin    = priceForm.querySelector('[id$="-GTE-input"]');
    const inputMax    = priceForm.querySelector('[id$="-LTE-input"]');
    const totalMax    = parseFloat(rangeMax.max);

    function updateRangeTrack() {
      const pct1 = (parseFloat(rangeMin.value) / totalMax) * 100;
      const pct2 = (parseFloat(rangeMax.value) / totalMax) * 100;
      rangeMin.style.setProperty('--range-pct-left',  pct1 + '%');
      rangeMax.style.setProperty('--range-pct-right', (100 - pct2) + '%');
    }

    rangeMin.addEventListener('input', () => {
      if (parseFloat(rangeMin.value) > parseFloat(rangeMax.value)) {
        rangeMin.value = rangeMax.value;
      }
      inputMin.value = rangeMin.value;
      updateRangeTrack();
    });

    rangeMax.addEventListener('input', () => {
      if (parseFloat(rangeMax.value) < parseFloat(rangeMin.value)) {
        rangeMax.value = rangeMin.value;
      }
      inputMax.value = rangeMax.value;
      updateRangeTrack();
    });

    [rangeMin, rangeMax].forEach((slider) => {
      slider.addEventListener('change', () => {
        priceForm.submit();
      });
    });

    updateRangeTrack();
  }

  /* ---- Sort select ---- */
  const sortSelect = document.getElementById('SortBy');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('sort_by', sortSelect.value);
      window.location.assign(url.toString());
    });
  }

  /* ---- View as grid / list ---- */
  const viewBtns = document.querySelectorAll('.sort-filter-bar__view-btn');
  const productGrid = document.getElementById('ProductGrid');

  viewBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      viewBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      if (productGrid) {
        productGrid.dataset.view = view;
        productGrid.classList.toggle('product-grid--list', view === 'list');
      }
    });
  });

  /* ---- Filter drawer (mobile / drawer layout) ---- */
  const filterBtn    = document.querySelector('.sort-filter-bar__filter-btn');
  const filterDrawer = document.getElementById('FilterDrawer');

  if (filterBtn && filterDrawer) {
    filterBtn.addEventListener('click', () => {
      const isOpen = filterDrawer.getAttribute('aria-hidden') === 'false';
      filterDrawer.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
      filterDrawer.classList.toggle('is-open', !isOpen);
      filterBtn.setAttribute('aria-expanded', (!isOpen).toString());
    });
  }

  /* ---- Filter sidebar toggle (desktop vertical) ---- */
  const sidebarFilterBtn = document.querySelector('.sort-filter-bar__filter-btn');
  const filterSidebar    = document.querySelector('.collection-layout__sidebar');

  if (sidebarFilterBtn && filterSidebar) {
    sidebarFilterBtn.addEventListener('click', () => {
      filterSidebar.classList.toggle('is-hidden');
    });
  }

  /* ---- Load more ---- */
  const loadMoreBtn = document.getElementById('LoadMore');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async () => {
      const url = loadMoreBtn.dataset.url;
      if (!url) return;

      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'Loading…';

      try {
        const resp = await fetch(url);
        const html = await resp.text();
        const doc  = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('#ProductGrid .product-grid__item');
        items.forEach((item) => productGrid.appendChild(item));

        const nextUrl = doc.getElementById('LoadMore')?.dataset.url;
        if (nextUrl) {
          loadMoreBtn.dataset.url = nextUrl;
          loadMoreBtn.disabled    = false;
          loadMoreBtn.textContent = 'Show More';
        } else {
          loadMoreBtn.remove();
        }
      } catch (e) {
        loadMoreBtn.disabled    = false;
        loadMoreBtn.textContent = 'Show More';
      }
    });
  }

  /* ---- Infinite scroll ---- */
  const infiniteTarget = document.getElementById('InfiniteScroll');
  if (infiniteTarget && 'IntersectionObserver' in window) {
    let loading = false;

    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loading) return;
      const url = infiniteTarget.dataset.url;
      if (!url) { observer.disconnect(); return; }

      loading = true;
      try {
        const resp = await fetch(url);
        const html = await resp.text();
        const doc  = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('#ProductGrid .product-grid__item');
        items.forEach((item) => productGrid.insertBefore(item, infiniteTarget));

        const nextUrl = doc.getElementById('InfiniteScroll')?.dataset.url;
        if (nextUrl) {
          infiniteTarget.dataset.url = nextUrl;
        } else {
          observer.disconnect();
          infiniteTarget.remove();
        }
      } finally {
        loading = false;
      }
    }, { rootMargin: '200px' });

    observer.observe(infiniteTarget);
  }

  /* ---- Compare ---- */
  const compareToggle = document.getElementById('CompareToggle');
  if (compareToggle) {
    compareToggle.addEventListener('change', () => {
      document.querySelectorAll('.product-card__compare').forEach((el) => {
        el.style.display = compareToggle.checked ? 'block' : 'none';
      });
    });
  }

})();
