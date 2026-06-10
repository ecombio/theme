console.log('Collection JS loaded');

/* ============================================================
   collection.js
   - Filter group accordion collapse/expand
   - Tag & availability filters → URL params (Shopify storefront API style)
   - Price range apply
   - Active filter pills + count badge
   - Sort select → URL sort_by param
   - Mobile sidebar drawer open/close
   ============================================================ */

(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return [...(root || document).querySelectorAll(sel)]; }

  /**
   * Read current URL search params into a plain object.
   * Multi-value keys (like tag[]) become arrays.
   */
  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  /** Navigate to the current collection URL with updated params, preserving page root. */
  function applyParams(params) {
    const url = new URL(window.location.href);
    url.search = params.toString();
    // Remove page param on filter change so we don't land on a non-existent page
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

      // Ensure initial state matches aria-expanded
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      body.hidden = !isExpanded;
    });
  }

  // ── Tag filters (checkbox) ─────────────────────────────────

  /**
   * Shopify collection tag filtering uses URL path segments:
   * /collections/bikes/color_red+brand_acme
   * But the storefront filter API (if enabled) uses query params.
   * We'll use the simpler tag path approach as a fallback,
   * and also support filter.p.* / filter.v.* query params.
   *
   * Strategy: collect all checked tags, build /collections/{handle}/{tags} URL.
   */

  function getCollectionBase() {
    // Strip any existing tag path: /collections/bikes/tag1+tag2 → /collections/bikes
    const parts = window.location.pathname.split('/');
    // parts: ['', 'collections', 'handle', 'tag-segment?']
    const collIdx = parts.indexOf('collections');
    if (collIdx === -1) return window.location.pathname;
    return '/' + parts.slice(1, collIdx + 2).join('/');
  }

  function getActiveTags() {
    // Tags live in the path after the collection handle
    const parts = window.location.pathname.split('/');
    const collIdx = parts.indexOf('collections');
    if (collIdx === -1 || !parts[collIdx + 2]) return [];
    return parts[collIdx + 2].split('+').filter(Boolean);
  }

  function applyTagsToURL(tags) {
    const base = getCollectionBase();
    const params = getParams();
    // Preserve sort_by and filter.p.available and filter.v.price.*
    let path = base;
    if (tags.length) {
      path += '/' + tags.join('+');
    }
    const queryStr = params.toString();
    window.location.href = path + (queryStr ? '?' + queryStr : '');
  }

  function initTagFilters() {
    const checkboxes = qsa('[data-filter-type="tag"]');
    if (!checkboxes.length) return;

    const activeTags = getActiveTags();

    // Sync DOM checkboxes to URL
    checkboxes.forEach(function (cb) {
      const tag = cb.getAttribute('data-tag');
      if (tag) cb.checked = activeTags.includes(tag);
    });

    checkboxes.forEach(function (cb) {
      cb.addEventListener('change', function () {
        const tag = cb.getAttribute('data-tag');
        if (!tag) return;
        let tags = getActiveTags();
        if (cb.checked) {
          if (!tags.includes(tag)) tags.push(tag);
        } else {
          tags = tags.filter(function (t) { return t !== tag; });
        }
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
      if (cb.checked) {
        params.set('filter.p.available', 'true');
      } else {
        params.delete('filter.p.available');
      }
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

      if (min) {
        params.set('filter.v.price.gte', (parseFloat(min) * 100).toFixed(0));
      } else {
        params.delete('filter.v.price.gte');
      }

      if (max) {
        params.set('filter.v.price.lte', (parseFloat(max) * 100).toFixed(0));
      } else {
        params.delete('filter.v.price.lte');
      }

      applyParams(params);
    });

    // Also trigger on Enter key
    [qs('[data-filter-type="price-min"]'), qs('[data-filter-type="price-max"]')].forEach(function (input) {
      if (!input) return;
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') applyBtn.click();
      });
    });
  }

  // ── Clear all ──────────────────────────────────────────────

  function initClearAll() {
    const btn = qs('#filters-clear-all');
    if (!btn) return;
    btn.addEventListener('click', function () {
      const base = getCollectionBase();
      const sortBy = getParams().get('sort_by');
      const query = sortBy ? '?sort_by=' + encodeURIComponent(sortBy) : '';
      window.location.href = base + query;
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

    // Tag pills
    activeTags.forEach(function (tag) {
      count++;
      const pill = makePill(tag.replace(/-/g, ' '), function () {
        const tags = getActiveTags().filter(function (t) { return t !== tag; });
        applyTagsToURL(tags);
      });
      bar.appendChild(pill);
    });

    // Availability pill
    if (params.get('filter.p.available') === 'true') {
      count++;
      const pill = makePill('In stock', function () {
        params.delete('filter.p.available');
        applyParams(params);
      });
      bar.appendChild(pill);
    }

    // Price pill
    const priceGte = params.get('filter.v.price.gte');
    const priceLte = params.get('filter.v.price.lte');
    if (priceGte || priceLte) {
      count++;
      const min = priceGte ? '$' + (parseInt(priceGte, 10) / 100).toFixed(0) : '';
      const max = priceLte ? '$' + (parseInt(priceLte, 10) / 100).toFixed(0) : '';
      let label = 'Price: ';
      if (min && max) label += min + ' – ' + max;
      else if (min) label += min + '+';
      else if (max) label += 'up to ' + max;

      const pill = makePill(label, function () {
        params.delete('filter.v.price.gte');
        params.delete('filter.v.price.lte');
        applyParams(params);
      });
      bar.appendChild(pill);
    }

    if (countBadge) {
      countBadge.textContent = count > 0 ? String(count) : '';
    }
  }

  function makePill(label, onRemove) {
    const pill = document.createElement('div');
    pill.className = 'filter-pill';
    pill.innerHTML =
      '<span>' + label + '</span>' +
      '<button class="filter-pill__remove" type="button" aria-label="Remove ' + label + ' filter">×</button>';
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

  // ── Mobile drawer ──────────────────────────────────────────

  function initMobileDrawer() {
    const sidebar   = qs('#collection-filters');
    const openBtn   = qs('#filters-open-btn');
    const backdrop  = qs('#filters-backdrop');
    if (!sidebar || !openBtn) return;

    // Inject close button if not already present
    if (!qs('.collection-filters__close', sidebar)) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'collection-filters__close';
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close filters');
      closeBtn.innerHTML = '×';
      sidebar.insertBefore(closeBtn, sidebar.firstChild);
      closeBtn.addEventListener('click', closeDrawer);
    }

    function openDrawer() {
      sidebar.classList.add('is-open');
      openBtn.setAttribute('aria-expanded', 'true');
      if (backdrop) {
        backdrop.classList.add('is-active');
        // Force reflow so transition fires
        backdrop.offsetHeight; // eslint-disable-line no-unused-expressions
        backdrop.classList.add('is-visible');
      }
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      sidebar.classList.remove('is-open');
      openBtn.setAttribute('aria-expanded', 'false');
      if (backdrop) {
        backdrop.classList.remove('is-visible');
        setTimeout(function () {
          backdrop.classList.remove('is-active');
        }, 280);
      }
      document.body.style.overflow = '';
    }

    openBtn.addEventListener('click', openDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
        closeDrawer();
      }
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
    initMobileDrawer();
    buildPills();
  });

})();
