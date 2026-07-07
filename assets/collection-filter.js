/* assets/collection-filter.js
   Filter drawer (mobile), desktop collapse toggle, and live AJAX
   filtering for snippets/collection-filter.liquid.

   Depends on window.CollectionBackdrop, defined in main-collection.js
   (the shared mobile overlay used by both the filter drawer and the
   mobile sort sheet). This file must be loaded AFTER main-collection.js
   — it's referenced lazily inside click handlers below, but keeping the
   load order correct removes any fragility around that. */

(function () {
  'use strict';

  var filterPanel   = document.getElementById('collection-filter');
  var filterToggles = document.querySelectorAll('[data-filter-toggle]');

  if (!filterPanel) return;

  /* ── Inject mobile close bar ──────────────────────────────── */
  if (!filterPanel.querySelector('.collection-filter__close')) {
    var closeBar = document.createElement('div');
    closeBar.className = 'collection-filter__close';
    closeBar.innerHTML =
      '<span class="collection-filter__close-label">Filters</span>' +
      '<button class="collection-filter__close-btn" type="button" aria-label="Close filters">&times;</button>';
    filterPanel.insertBefore(closeBar, filterPanel.firstChild);
    closeBar.querySelector('.collection-filter__close-btn')
      .addEventListener('click', closeFilter);
  }

  /* ── Open / close ─────────────────────────────────────────── */
  function openFilter() {
    filterPanel.removeAttribute('hidden');
    requestAnimationFrame(function () {
      filterPanel.classList.add('is-open');
    });
    filterToggles.forEach(function (t) {
      t.setAttribute('aria-expanded', 'true');
    });
    document.body.style.overflow = 'hidden';

    if (window.CollectionBackdrop) {
      window.CollectionBackdrop.open(closeFilter);
    }
  }

  function closeFilter() {
    filterPanel.classList.remove('is-open');
    filterToggles.forEach(function (t) {
      t.setAttribute('aria-expanded', 'false');
    });
    document.body.style.overflow = '';

    filterPanel.addEventListener('transitionend', function handler() {
      if (!filterPanel.classList.contains('is-open')) {
        filterPanel.setAttribute('hidden', '');
      }
      filterPanel.removeEventListener('transitionend', handler);
    });

    if (window.CollectionBackdrop) {
      window.CollectionBackdrop.close(closeFilter);
    }
  }

  /* ── Toggle buttons ───────────────────────────────────────── */
  filterToggles.forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      var isMobile = window.innerWidth <= 768;

      if (isMobile) {
        filterPanel.classList.contains('is-open') ? closeFilter() : openFilter();
      } else {
        var isOpen = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');

        if (isOpen) {
          filterPanel.setAttribute('hidden', '');
          document.querySelector('.collection-body')
            && document.querySelector('.collection-body')
               .classList.add('collection-body--filters-hidden');
        } else {
          filterPanel.removeAttribute('hidden');
          document.querySelector('.collection-body')
            && document.querySelector('.collection-body')
               .classList.remove('collection-body--filters-hidden');
        }
      }
    });
  });

  /* ── Live filtering (AJAX via Section Rendering API) ─────────
     Checking/unchecking a filter (or changing a price field)
     re-fetches just this section's HTML with the new query params
     and swaps in the updated product grid + filter sidebar, with
     no full page reload. Unchecking a filter is just another
     change event, so it live-reverts the same way.

     Falls back to a normal full-page navigation if fetch fails,
     or if JS never runs at all (the form's method="get" + inputs'
     name attributes still work as plain query params). ─────── */
  /* ── Active-filters strip: scroll nav ────────────────────────
     Rendered by snippets/collection-active-filters.liquid, above the
     product grid. Its prev/next buttons just scroll the track — the
     live-filter refresh below (applyFiltersLive) swaps in a fresh
     copy of the whole #collection-active-filters element on every
     filter change, so this needs re-running after each swap too. ──
  */
  function initActiveFiltersNav() {
    var bar = document.getElementById('collection-active-filters');
    if (!bar) return;

    var track = bar.querySelector('[data-active-filters-track]');
    var prev  = bar.querySelector('[data-active-filters-prev]');
    var next  = bar.querySelector('[data-active-filters-next]');
    if (!track) return;

    function updateNavState() {
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled =
        track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    }

    function scrollByAmount(dir) {
      track.scrollBy({ left: dir * (track.clientWidth * 0.8), behavior: 'smooth' });
    }

    if (prev) prev.addEventListener('click', function () { scrollByAmount(-1); });
    if (next) next.addEventListener('click', function () { scrollByAmount(1); });
    track.addEventListener('scroll', updateNavState);
    updateNavState();
  }

  var filterForm    = document.getElementById('FilterForm');
  var sectionRoot    = document.getElementById('main-collection');
  var sectionId      = sectionRoot ? sectionRoot.dataset.sectionId : null;
  var filterRequestToken = 0;

  function buildFilterUrl() {
    // Preserve sort_by (and any other non-filter params) from the
    // CURRENT url before rebuilding the query string from the filter
    // form, so applying a filter never resets sort back to default.
    var currentUrl = new URL(window.location.href);
    var existingSortBy = currentUrl.searchParams.get('sort_by');

    var url = new URL(window.location.href);
    url.search = '';

    new FormData(filterForm).forEach(function (val, key) {
      // Skip blank values (e.g. an untouched price field with no value
      // set) — submitting an empty filter.v.price.gte/lte param can
      // cause the storefront to treat the range as effectively zero,
      // filtering out products that should still match.
      if (val === '') return;
      url.searchParams.append(key, val);
    });

    if (existingSortBy && !url.searchParams.has('sort_by')) {
      url.searchParams.set('sort_by', existingSortBy);
    }

    // Preserve active tab
    var page = document.querySelector('[data-collection-page]');
    var activeTab = page ? page.dataset.activeTab : 'products';
    url.searchParams.set('tab', activeTab);

    return url;
  }

  function bindFilterFieldListeners() {
    if (!filterForm) return;
    filterForm.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
      input.addEventListener('change', function () {
        applyFiltersLive(true);
      });
    });
    filterForm.querySelectorAll('input[type="number"]').forEach(function (input) {
      input.addEventListener('change', function () {
        applyFiltersLive(true);
      });
    });
  }

  /* ── Price: dual-range slider + quick-pick brackets ──────────
     Keeps the min./max. number inputs, the two-thumb <input type=
     "range"> slider, and the bracket radios all in sync. The number
     inputs stay the source of truth for what actually gets submitted
     — the slider and radios just write into them and then dispatch a
     'change' event, which bindFilterFieldListeners() above already
     wires up to applyFiltersLive(). Needs re-running after every AJAX
     swap since the form's innerHTML (and therefore these elements)
     gets replaced. ─────────────────────────────────────────────── */
  function initPriceFilters(scope) {
    var wraps = (scope || document).querySelectorAll('[data-price-filter]');

    wraps.forEach(function (wrap) {
      var minInput    = wrap.querySelector('[data-price-input="min"]');
      var maxInput    = wrap.querySelector('[data-price-input="max"]');
      var minThumb    = wrap.querySelector('[data-range-thumb="min"]');
      var maxThumb    = wrap.querySelector('[data-range-thumb="max"]');
      var activeTrack = wrap.querySelector('[data-range-active]');
      var brackets    = wrap.querySelectorAll('[data-price-bracket]');

      if (!minInput || !maxInput || !minThumb || !maxThumb) return;

      var rangeMax = parseFloat(maxThumb.max) || 0;

      function paintTrack() {
        if (!activeTrack || !rangeMax) return;
        var lo = parseFloat(minThumb.value) || 0;
        var hi = parseFloat(maxThumb.value) || rangeMax;
        activeTrack.style.left  = (lo / rangeMax * 100) + '%';
        activeTrack.style.right = (100 - (hi / rangeMax * 100)) + '%';
      }

      // Number inputs -> slider (typing in min./max. moves the thumbs)
      function fieldsToSlider() {
        var lo = minInput.value === '' ? 0 : parseFloat(minInput.value);
        var hi = maxInput.value === '' ? rangeMax : parseFloat(maxInput.value);
        minThumb.value = lo;
        maxThumb.value = hi;
        paintTrack();
      }

      // Slider -> number inputs (dragging a thumb updates min./max.)
      function sliderToFields(commit) {
        var lo = parseFloat(minThumb.value);
        var hi = parseFloat(maxThumb.value);

        // Don't let the two thumbs cross each other.
        if (lo > hi) {
          if (document.activeElement === maxThumb) { lo = hi; minThumb.value = lo; }
          else { hi = lo; maxThumb.value = hi; }
        }

        minInput.value = lo;
        maxInput.value = hi;
        paintTrack();

        if (commit) {
          minInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Live-update the track while dragging, only fire the AJAX
      // request once the drag ends ('change' fires on mouseup/release).
      minThumb.addEventListener('input', function () { sliderToFields(false); });
      maxThumb.addEventListener('input', function () { sliderToFields(false); });
      minThumb.addEventListener('change', function () { sliderToFields(true); });
      maxThumb.addEventListener('change', function () { sliderToFields(true); });

      // Bring whichever thumb the user grabs to the front so two
      // thumbs sitting at (or near) the same value can both be dragged.
      [minThumb, maxThumb].forEach(function (thumb) {
        thumb.addEventListener('pointerdown', function () {
          minThumb.classList.remove('is-active-top');
          maxThumb.classList.remove('is-active-top');
          thumb.classList.add('is-active-top');
        });
      });

      minInput.addEventListener('input', fieldsToSlider);
      maxInput.addEventListener('input', fieldsToSlider);

      brackets.forEach(function (radio) {
        radio.addEventListener('change', function () {
          minInput.value = radio.dataset.min || 0;
          maxInput.value = radio.dataset.max || '';
          fieldsToSlider();
          minInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });

      paintTrack();
    });
  }

  function applyFiltersLive(pushHistory) {
    if (!filterForm) return;

    var displayUrl = buildFilterUrl();

    if (!sectionId) {
      // No section id available (e.g. template markup out of date) —
      // fall back to the old full-page-reload behavior rather than
      // silently doing nothing.
      window.location.href = displayUrl.toString();
      return;
    }

    var fetchUrl = new URL(displayUrl.toString());
    fetchUrl.searchParams.set('section_id', sectionId);

    var thisRequest = ++filterRequestToken;
    var grid = document.querySelector('.product-feed__grid');
    filterForm.setAttribute('aria-busy', 'true');
    if (grid) grid.style.opacity = '0.5';

    fetch(fetchUrl.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('Filter request failed');
        return res.text();
      })
      .then(function (html) {
        // Another change happened while this request was in flight —
        // drop this (now-stale) response instead of overwriting newer
        // results with older ones.
        if (thisRequest !== filterRequestToken) return;

        var doc = new DOMParser().parseFromString(html, 'text/html');

        var newProductFeed = doc.getElementById('product-feed');
        var currentProductFeed = document.getElementById('product-feed');
        if (newProductFeed && currentProductFeed) {
          currentProductFeed.replaceWith(newProductFeed);
        }

        var newActiveFilters = doc.getElementById('collection-active-filters');
        var currentActiveFilters = document.getElementById('collection-active-filters');
        if (newActiveFilters && currentActiveFilters) {
          currentActiveFilters.replaceWith(newActiveFilters);
          initActiveFiltersNav();
        }

        var newFilterForm = doc.getElementById('FilterForm');
        if (newFilterForm) {
          // Swap in the refreshed filter markup (updated counts,
          // active pills, disabled options) and rebind listeners,
          // since the old input elements were just replaced.
          filterForm.innerHTML = newFilterForm.innerHTML;
          bindFilterFieldListeners();
          initPriceFilters(filterForm);
        }

        var newPagination = doc.querySelector('.pagination');
        var currentPagination = document.querySelector('.pagination');
        if (currentPagination) currentPagination.remove();
        if (newPagination) {
          document.querySelector('.collection-feed__panel[data-panel="products"]')
            .appendChild(newPagination);
        }

        if (pushHistory) {
          history.pushState({ tab: displayUrl.searchParams.get('tab') }, '', displayUrl.toString());
        }

        filterForm.removeAttribute('aria-busy');
      })
      .catch(function () {
        // Network error, bad response, etc. — don't leave the user
        // stuck with a half-applied filter and a dimmed grid.
        window.location.href = displayUrl.toString();
      });
  }

  bindFilterFieldListeners();
  initPriceFilters(filterForm);
  initActiveFiltersNav();

  if (filterForm) {
    // Keep the Apply button / Enter-key submit working (e.g. after
    // typing in a price field and pressing Enter), routed through the
    // same live path instead of a full navigation.
    filterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      applyFiltersLive(true);
    });
  }

  /* ── Back/forward support ─────────────────────────────────── */
  window.addEventListener('popstate', function () {
    applyFiltersLive(false);
  });

  /* ── Expose close for external use (e.g. backdrop click) ─── */
  window.CollectionFilter = { close: closeFilter };

})();