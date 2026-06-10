console.log('Collection JS loaded');

/* ============================================================
   collection.js
   - Filter group accordion collapse/expand
   - Tag & availability filters → URL params
   - Price range apply
   - Active filter pills + count badge
   - Sort select → URL sort_by param
   - Mobile sidebar drawer open/close (≤1023px)
   - Desktop filter sidebar toggle (≥1024px)
   ============================================================ */

(function () {
  'use strict';

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return [...(root || document).querySelectorAll(sel)]; }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function applyParams(params) {
    const url = new URL(window.location.href);
    url.search = params.toString();
    url.searchParams.delete('page');
    window.location.href = url.toString();
  }

  // ── Accordion ──────────────────────────────────────────────

  function initAccordions() {
    qsa('.filter-group__toggle').forEach(function (btn) {
      const targetId = btn.getAttribute('aria-controls');
      const body = qs('#' + targetId);
      if (!body) return;
      btn.addEventListener('click', function () {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        body.hidden = expanded;
      });
      body.hidden = btn.getAttribute('aria-expanded') !== 'true';
    });
  }

  // ── Tag filters ────────────────────────────────────────────

  function getCollectionBase() {
    const parts = window.location.pathname.split('/');
    const collIdx = parts.indexOf('collections');
    if (collIdx === -1) return window.location.pathname;
    return '/' + parts.slice(1, collIdx + 2).join('/');
  }

  function getActiveTags() {
    const parts = window.location.pathname.split('/');
    const collIdx = parts.indexOf('collections');
    if (collIdx === -1 || !parts[collIdx + 2]) return [];
    return parts[collIdx + 2].split('+').filter(Boolean);
  }

  function applyTagsToURL(tags) {
    const base = getCollectionBase();
    const params = getParams();
    const path = base + (tags.length ? '/' + tags.join('+') : '');
    const queryStr = params.toString();
    window.location.href = path + (queryStr ? '?' + queryStr : '');
  }

  function initTagFilters() {
    const checkboxes = qsa('[data-filter-type="tag"]');
    if (!checkboxes.length) return;
    const activeTags = getActiveTags();
    checkboxes.forEach(function (cb) {
      const tag = cb.getAttribute('data-tag');
      if (tag) cb.checked = activeTags.includes(tag);
      cb.addEventListener('change', function () {
        if (!tag) return;
        let tags = getActiveTags();
        if (cb.checked) { if (!tags.includes(tag)) tags.push(tag); }
        else { tags = tags.filter(function (t) { return t !== tag; }); }
        applyTagsToURL(tags);
      });
    });
  }

  // ── Availability filter ────────────────────────────────────

  function initAvailabilityFilter() {
    const cb = qs('[data-filter-type="availability"]');
    if (!cb) return;
    cb.addEventListener('change', function () {
      const params = getParams();
      if (cb.checked) params.set('filter.p.available', 'true');
      else params.delete('filter.p.available');
      applyParams(params);
    });
  }

  // ── Price filter ───────────────────────────────────────────

  function initPriceFilter() {
    const applyBtn = qs('[data-filter-price-apply]');
    if (!applyBtn) return;
    applyBtn.addEventListener('click', function () {
      const minInput = qs('[data-filter-type="price-min"]');
      const maxInput = qs('[data-filter-type="price-max"]');
      const params = getParams();
      const min = minInput ? minInput.value.trim() : '';
      const max = maxInput ? maxInput.value.trim() : '';
      if (min) params.set('filter.v.price.gte', (parseFloat(min) * 100).toFixed(0));
      else params.delete('filter.v.price.gte');
      if (max) params.set('filter.v.price.lte', (parseFloat(max) * 100).toFixed(0));
      else params.delete('filter.v.price.lte');
      applyParams(params);
    });
    [qs('[data-filter-type="price-min"]'), qs('[data-filter-type="price-max"]')].forEach(function (input) {
      if (!input) return;
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') applyBtn.click(); });
    });
  }

  // ── Clear all ──────────────────────────────────────────────

  function initClearAll() {
    const btn = qs('#filters-clear-all');
    if (!btn) return;
    btn.addEventListener('click', function () {
      const base = getCollectionBase();
      const sortBy = getParams().get('sort_by');
      window.location.href = base + (sortBy ? '?sort_by=' + encodeURIComponent(sortBy) : '');
    });
  }

  // ── Active filter pills ────────────────────────────────────

  function buildPills() {
    const bar = qs('#active-filters-bar');
    const countBadge = qs('#active-filter-count');
    if (!bar) return;
    bar.innerHTML = '';
    let count = 0;
    const params = getParams();
    const activeTags = getActiveTags();

    activeTags.forEach(function (tag) {
      count++;
      bar.appendChild(makePill(tag.replace(/-/g, ' '), function () {
        applyTagsToURL(getActiveTags().filter(function (t) { return t !== tag; }));
      }));
    });

    if (params.get('filter.p.available') === 'true') {
      count++;
      bar.appendChild(makePill('In stock', function () {
        params.delete('filter.p.available');
        applyParams(params);
      }));
    }

    const priceGte = params.get('filter.v.price.gte');
    const priceLte = params.get('filter.v.price.lte');
    if (priceGte || priceLte) {
      count++;
      const min = priceGte ? '$' + (parseInt(priceGte, 10) / 100).toFixed(0) : '';
      const max = priceLte ? '$' + (parseInt(priceLte, 10) / 100).toFixed(0) : '';
      let label = 'Price: ';
      if (min && max) label += min + ' – ' + max;
      else if (min) label += min + '+';
      else label += 'up to ' + max;
      bar.appendChild(makePill(label, function () {
        params.delete('filter.v.price.gte');
        params.delete('filter.v.price.lte');
        applyParams(params);
      }));
    }

    if (countBadge) countBadge.textContent = count > 0 ? String(count) : '';
  }

  function makePill(label, onRemove) {
    const pill = document.createElement('div');
    pill.className = 'filter-pill';
    pill.innerHTML =
      '<span>' + label + '</span>' +
      '<button class="filter-pill__remove" type="button" aria-label="Remove ' + label + ' filter">\u00d7</button>';
    pill.querySelector('.filter-pill__remove').addEventListener('click', onRemove);
    return pill;
  }

  // ── Sort ───────────────────────────────────────────────────

  function initSort() {
    const select = qs('[data-sort-select]');
    if (!select) return;
    select.addEventListener('change', function () {
      const params = getParams();
      params.set('sort_by', select.value);
      applyParams(params);
    });
  }

  // ── Filter button — drawer on mobile, sidebar toggle on desktop ──

  function initFilterBtn() {
    const sidebar  = qs('#collection-filters');
    const openBtn  = qs('#filters-open-btn');
    const backdrop = qs('#filters-backdrop');
    if (!sidebar || !openBtn) return;

    // Inject close button for mobile drawer
    if (!qs('.collection-filters__close', sidebar)) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'collection-filters__close';
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close filters');
      closeBtn.innerHTML = '\u00d7';
      sidebar.insertBefore(closeBtn, sidebar.firstChild);
      closeBtn.addEventListener('click', closeDrawer);
    }

    function isMobile() { return window.innerWidth < 1024; }

    function openDrawer() {
      sidebar.classList.add('is-open');
      openBtn.setAttribute('aria-expanded', 'true');
      if (backdrop) {
        backdrop.classList.add('is-active');
        backdrop.offsetHeight;
        backdrop.classList.add('is-visible');
      }
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      sidebar.classList.remove('is-open');
      openBtn.setAttribute('aria-expanded', 'false');
      if (backdrop) {
        backdrop.classList.remove('is-visible');
        setTimeout(function () { backdrop.classList.remove('is-active'); }, 280);
      }
      document.body.style.overflow = '';
    }

    function toggleDesktopSidebar() {
      const isOpen = sidebar.classList.toggle('sidebar-open');
      openBtn.setAttribute('aria-expanded', String(isOpen));
    }

    openBtn.addEventListener('click', function () {
      if (isMobile()) openDrawer();
      else toggleDesktopSidebar();
    });

    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) closeDrawer();
    });
  }

  // ── Init ───────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    initAccordions();
    initTagFilters();
    initAvailabilityFilter();
    initPriceFilter();
    initClearAll();
    initSort();
    initFilterBtn();
    buildPills();
  });

})();
