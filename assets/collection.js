console.log('Collection JS loaded');

/* ============================================================
   collection.js
   Wired to Shopify Search & Discovery (collection.filters)
   - Filter checkboxes → url_to_add / url_to_remove
   - Price range apply → filter.v.price.gte / lte params
   - Active filter pills built from URL params
   - Active count badge on filter button
   - Sort select → sort_by param
   - Accordion collapse/expand
   - Mobile sidebar drawer (≤1023px)
   - Desktop sidebar toggle (≥1024px)
   - Sticky bar height → --sticky-bar-height CSS var
   ============================================================ */

(function () {
  'use strict';

  function qs(sel, root)  { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return [...(root || document).querySelectorAll(sel)]; }
  function getParams()    { return new URLSearchParams(window.location.search); }

  function navigate(url) {
    window.location.href = url;
  }

  // ── Accordion ──────────────────────────────────────────────

  function initAccordions() {
    qsa('.filter-group__toggle').forEach(function (btn) {
      const body = qs('#' + btn.getAttribute('aria-controls'));
      if (!body) return;
      // Sync hidden state to aria-expanded on load
      body.hidden = btn.getAttribute('aria-expanded') !== 'true';
      btn.addEventListener('click', function () {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        body.hidden = expanded;
      });
    });
  }

  // ── List / boolean filter checkboxes ──────────────────────
  // Each checkbox carries data-filter-url-add and data-filter-url-remove
  // from the Liquid template — just navigate to the right one.

  function initFilterCheckboxes() {
    qsa('.filter-option__checkbox[data-filter-url-add]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const url = cb.checked
          ? cb.getAttribute('data-filter-url-add')
          : cb.getAttribute('data-filter-url-remove');
        if (url) navigate(url);
      });
    });
  }

  // ── Price filter ───────────────────────────────────────────
  // Reads param names from the inputs' name attributes (set by Liquid).

  function initPriceFilter() {
    const applyBtn = qs('[data-filter-price-apply]');
    if (!applyBtn) return;

    function apply() {
      const minInput = qs('[data-filter-type="price-min"]');
      const maxInput = qs('[data-filter-type="price-max"]');
      const params   = getParams();
      const min      = minInput ? minInput.value.trim() : '';
      const max      = maxInput ? maxInput.value.trim() : '';

      // Search & Discovery expects prices in cents
      if (min) params.set(minInput.name, (parseFloat(min) * 100).toFixed(0));
      else     params.delete(minInput ? minInput.name : 'filter.v.price.gte');

      if (max) params.set(maxInput.name, (parseFloat(max) * 100).toFixed(0));
      else     params.delete(maxInput ? maxInput.name : 'filter.v.price.lte');

      params.delete('page');

      const url = new URL(window.location.href);
      url.search = params.toString();
      navigate(url.toString());
    }

    applyBtn.addEventListener('click', apply);

    [qs('[data-filter-type="price-min"]'), qs('[data-filter-type="price-max"]')].forEach(function (input) {
      if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') apply(); });
    });
  }

  // ── Active filter pills ────────────────────────────────────
  // Reads the current URL params and renders remove pills.
  // Search & Discovery filter params look like:
  //   filter.p.available=true
  //   filter.p.m.swatch.color=Red
  //   filter.v.price.gte=5000  (cents)
  //   filter.v.price.lte=20000

  function buildPills() {
    const bar        = qs('#active-filters-bar');
    const countBadge = qs('#active-filter-count');
    if (!bar) return;

    bar.innerHTML = '';
    let count = 0;
    const params = getParams();

    // Collect all filter.* params from URL
    const priceGteKey = findParamKey(params, /filter\.v\.price\.gte/i);
    const priceLteKey = findParamKey(params, /filter\.v\.price\.lte/i);
    let   hasPricePill = false;

    params.forEach(function (value, key) {
      if (!/^filter\./i.test(key)) return;

      // Price: combine into a single pill
      if (/filter\.v\.price\.(gte|lte)/i.test(key)) {
        if (!hasPricePill) {
          hasPricePill = true;
          count++;
          const gte = params.get(priceGteKey);
          const lte = params.get(priceLteKey);
          const min = gte ? '$' + (parseInt(gte, 10) / 100).toFixed(0) : '';
          const max = lte ? '$' + (parseInt(lte, 10) / 100).toFixed(0) : '';
          let label = 'Price: ';
          if (min && max) label += min + ' – ' + max;
          else if (min)   label += min + '+';
          else            label += 'up to ' + max;

          bar.appendChild(makePill(label, function () {
            const p = getParams();
            if (priceGteKey) p.delete(priceGteKey);
            if (priceLteKey) p.delete(priceLteKey);
            p.delete('page');
            const url = new URL(window.location.href);
            url.search = p.toString();
            navigate(url.toString());
          }));
        }
        return;
      }

      // All other filters
      count++;
      const label = formatFilterLabel(key, value);
      bar.appendChild(makePill(label, function () {
        const p   = getParams();
        // Remove only this specific key=value pair
        const all = p.getAll(key).filter(function (v) { return v !== value; });
        p.delete(key);
        all.forEach(function (v) { p.append(key, v); });
        p.delete('page');
        const url = new URL(window.location.href);
        url.search = p.toString();
        navigate(url.toString());
      }));
    });

    if (countBadge) countBadge.textContent = count > 0 ? String(count) : '';
  }

  function findParamKey(params, re) {
    let found = null;
    params.forEach(function (v, k) { if (re.test(k)) found = k; });
    return found;
  }

  function formatFilterLabel(key, value) {
    // Turn "filter.p.available" + "true" → "In stock"
    if (/filter\.p\.available/i.test(key)) return 'In stock';
    // Turn "filter.p.m.swatch.color" → "Color: Red"
    const parts = key.split('.');
    const name  = parts[parts.length - 1].replace(/_/g, ' ');
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    return label + ': ' + value.replace(/-/g, ' ');
  }

  function makePill(label, onRemove) {
    const pill = document.createElement('div');
    pill.className = 'filter-pill';
    const text   = document.createElement('span');
    text.textContent = label;
    const remove = document.createElement('button');
    remove.className = 'filter-pill__remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove ' + label + ' filter');
    remove.textContent = '\u00d7';
    remove.addEventListener('click', onRemove);
    pill.appendChild(text);
    pill.appendChild(remove);
    return pill;
  }

  // ── Sort ───────────────────────────────────────────────────

  function initSort() {
    const select = qs('[data-sort-select]');
    if (!select) return;
    select.addEventListener('change', function () {
      const params = getParams();
      params.set('sort_by', select.value);
      params.delete('page');
      const url = new URL(window.location.href);
      url.search = params.toString();
      navigate(url.toString());
    });
  }

  // ── Sidebar: drawer on mobile, toggle on desktop ──────────

  function initFilterBtn() {
    const sidebar  = qs('#collection-filters');
    const openBtn  = qs('#filters-open-btn');
    const backdrop = qs('#filters-backdrop');
    if (!sidebar || !openBtn) return;

    // Inject close button once
    if (!qs('.collection-filters__close', sidebar)) {
      const closeBtn       = document.createElement('button');
      closeBtn.className   = 'collection-filters__close';
      closeBtn.type        = 'button';
      closeBtn.setAttribute('aria-label', 'Close filters');
      closeBtn.textContent = '\u00d7';
      sidebar.insertBefore(closeBtn, sidebar.firstChild);
      closeBtn.addEventListener('click', closeDrawer);
    }

    function isMobile() { return window.innerWidth < 1024; }

    function openDrawer() {
      sidebar.classList.add('is-open');
      openBtn.setAttribute('aria-expanded', 'true');
      if (backdrop) {
        backdrop.classList.add('is-active');
        backdrop.offsetHeight; // force reflow
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

    function toggleDesktop() {
      const isOpen = sidebar.classList.toggle('sidebar-open');
      openBtn.setAttribute('aria-expanded', String(isOpen));
    }

    openBtn.addEventListener('click', function () {
      isMobile() ? openDrawer() : toggleDesktop();
    });

    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) closeDrawer();
    });
  }

  // ── Sticky bar height → CSS var ───────────────────────────

  function updateStickyBarHeight() {
    const bar = qs('#collection-sticky-bar') || qs('.collection-sticky-bar');
    if (!bar) return;
    document.documentElement.style.setProperty('--sticky-bar-height', bar.offsetHeight + 'px');
  }

  // ── Init ───────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    initAccordions();
    initFilterCheckboxes();
    initPriceFilter();
    initSort();
    initFilterBtn();
    buildPills();
    updateStickyBarHeight();

    window.addEventListener('resize', updateStickyBarHeight);

    const stickyBar = qs('.collection-sticky-bar');
    if (stickyBar && window.ResizeObserver) {
      new ResizeObserver(updateStickyBarHeight).observe(stickyBar);
    }
  });

})();