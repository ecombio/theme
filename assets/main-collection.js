console.log('Collection JS loaded');

/* ============================================================
   main-collection.js
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
      body.hidden = btn.getAttribute('aria-expanded') !== 'true';
      btn.addEventListener('click', function () {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        body.hidden = expanded;
      });
    });
  }

  // ── Filter checkboxes ──────────────────────────────────────

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

  function initPriceFilter() {
    const applyBtn = qs('[data-filter-price-apply]');
    if (!applyBtn) return;

    function apply() {
      const minInput = qs('[data-filter-type="price-min"]');
      const maxInput = qs('[data-filter-type="price-max"]');
      const params   = getParams();
      const min      = minInput ? minInput.value.trim() : '';
      const max      = maxInput ? maxInput.value.trim() : '';

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

  function buildPills() {
    const bar        = qs('#active-filters-bar');
    const countBadge = qs('#active-filter-count');
    if (!bar) return;

    bar.innerHTML = '';
    let count = 0;
    const params = getParams();

    const priceGteKey  = findParamKey(params, /filter\.v\.price\.gte/i);
    const priceLteKey  = findParamKey(params, /filter\.v\.price\.lte/i);
    let   hasPricePill = false;

    params.forEach(function (value, key) {
      if (!/^filter\./i.test(key)) return;

      if (/filter\.v\.price\.(gte|lte)/i.test(key)) {
        if (!hasPricePill) {
          hasPricePill = true;
          count++;
          const gte = params.get(priceGteKey);
          const lte = params.get(priceLteKey);
          const min = gte ? '$' + (parseInt(gte, 10) / 100).toFixed(0) : '';
          const max = lte ? '$' + (parseInt(lte, 10) / 100).toFixed(0) : '';
          let label = 'Price: ';
          if (min && max) label += min + ' \u2013 ' + max;
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

      count++;
      const label = formatFilterLabel(key, value);
      bar.appendChild(makePill(label, function () {
        const p   = getParams();
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
    if (/filter\.p\.available/i.test(key)) return 'In stock';
    const parts = key.split('.');
    const name  = parts[parts.length - 1].replace(/_/g, ' ');
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    return label + ': ' + value.replace(/-/g, ' ');
  }

  function makePill(label, onRemove) {
    const pill   = document.createElement('div');
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

  // ── Sidebar ────────────────────────────────────────────────

  function initFilterBtn() {
    const sidebar  = qs('#collection-filters');
    const openBtn  = qs('#filters-open-btn');
    const backdrop = qs('#filters-backdrop');
    if (!sidebar || !openBtn) return;

    if (!qs('.collection-filters__close', sidebar)) {
      const closeBtn     = document.createElement('button');
      closeBtn.className = 'collection-filters__close';
      closeBtn.type      = 'button';
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

    if (!isMobile()) {
      sidebar.classList.add('sidebar-open');
      openBtn.setAttribute('aria-expanded', 'true');
    }

    openBtn.addEventListener('click', function () {
      isMobile() ? openDrawer() : toggleDesktop();
    });

    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) closeDrawer();
    });
  }

  // ── Sticky bar height ──────────────────────────────────────

  function updateStickyBarHeight() {
    const bar = qs('#collection-sticky-bar') || qs('.collection-sticky-bar');
    if (!bar) return;
    document.documentElement.style.setProperty('--sticky-bar-height', bar.offsetHeight + 'px');
  }

  // ── Sub-collection carousel ────────────────────────────────

  function initSubcollectionCarousels() {
    qsa('[data-subcollection-carousel]').forEach(function (carousel) {
      var track   = carousel.querySelector('.subcollection-carousel__track');
      var prevBtn = carousel.querySelector('.subcollection-carousel__btn--prev');
      var nextBtn = carousel.querySelector('.subcollection-carousel__btn--next');

      if (!track || !prevBtn || !nextBtn) return;

      function scrollAmount() {
        return track.clientWidth;
      }

      function updateButtons() {
        prevBtn.disabled = track.scrollLeft <= 0;
        nextBtn.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
      }

      prevBtn.addEventListener('click', function () {
        track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
      });

      nextBtn.addEventListener('click', function () {
        track.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
      });

      track.addEventListener('scroll', updateButtons, { passive: true });

      updateButtons();
    });
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
    initSubcollectionCarousels();

    window.addEventListener('resize', updateStickyBarHeight);

    const stickyBar = qs('.collection-sticky-bar');
    if (stickyBar && window.ResizeObserver) {
      new ResizeObserver(updateStickyBarHeight).observe(stickyBar);
    }
  });

})();
// ── Sub-collection carousel ────────────────────────────────

  function initSubcollectionCarousels() {
    qsa('[data-subcollection-carousel]').forEach(function (carousel) {
      var track   = carousel.querySelector('.subcollection-carousel__track');
      var prevBtn = carousel.querySelector('.subcollection-carousel__btn--prev');
      var nextBtn = carousel.querySelector('.subcollection-carousel__btn--next');

      if (!track || !prevBtn || !nextBtn) return;

      // Mark button glyphs as decorative so aria-label is the only read text
      prevBtn.querySelector('*') && prevBtn.firstChild && (prevBtn.innerHTML = '<span aria-hidden="true">&#8249;</span>');
      nextBtn.querySelector('*') || (nextBtn.innerHTML = '<span aria-hidden="true">&#8250;</span>');

      // Scroll by one tile width rather than the full track width,
      // so no tiles get skipped over on wide screens.
      function scrollAmount() {
        var firstTile = track.querySelector('.subcollection-carousel__tile');
        if (firstTile) {
          var style = window.getComputedStyle(track);
          var gap   = parseFloat(style.columnGap) || parseFloat(style.gap) || 12;
          return firstTile.offsetWidth + gap;
        }
        // Fallback: scroll 40% of track width
        return Math.round(track.clientWidth * 0.4);
      }

      // Use Math.round to handle sub-pixel values on retina screens
      function atStart() { return Math.round(track.scrollLeft) <= 0; }
      function atEnd()   { return Math.round(track.scrollLeft + track.clientWidth) >= track.scrollWidth; }

      function updateButtons() {
        prevBtn.disabled = atStart();
        nextBtn.disabled = atEnd();
      }

      // Throttle scroll handler — only run updateButtons once per animation frame
      var rafPending = false;
      function onScroll() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(function () {
          updateButtons();
          rafPending = false;
        });
      }

      prevBtn.addEventListener('click', function () {
        track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
      });

      nextBtn.addEventListener('click', function () {
        track.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
      });

      track.addEventListener('scroll', onScroll, { passive: true });

      // Re-check button state when the track resizes (sidebar toggle, viewport change)
      if (window.ResizeObserver) {
        new ResizeObserver(updateButtons).observe(track);
      } else {
        window.addEventListener('resize', updateButtons);
      }

      // Initial state
      updateButtons();
    });
  }