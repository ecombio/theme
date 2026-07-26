/* assets/search-filter.js
   Owned by snippets/search-filter.liquid, which loads this file
   directly via a <script src> tag right after the <aside> -- same
   self-contained reasoning as search-filter.css: this snippet's
   interactivity shouldn't depend on sections/main-search.liquid or
   main-search.js loading in a particular order.

   Mirrors assets/collection-filter.js (mobile drawer, desktop
   collapse toggle, live AJAX filtering, price slider sync), adapted
   for search-filter.liquid/search-filter.css. Differences from the
   collection version, on purpose:

     1. NO window.CollectionBackdrop dependency. That pattern requires
        main-collection.js to load first and expose a global; this
        file instead talks directly to .search-mobile-backdrop (a
        plain DOM element already rendered by main-search.liquid), so
        there's no load-order fragility to worry about.

     2. NO collection-body--filters-hidden-style class toggle on
        desktop collapse. main-search.css's FLEXBOX FIX already
        established that toggling the [hidden] attribute on
        #search-filter is enough -- flexbox reflows .search-body__feed
        on its own. Doing anything more would just be the same
        redundant class collection-filter.js carries for a grid-era
        bug that doesn't apply here.

     3. The accordion (chevron / aria-expanded groups) lives in THIS
        file now, using [data-filter-group-toggle] -- NOT
        [data-filter-toggle]. That name is intentionally reserved for
        the panel-level open/close buttons (the toolbar's "Filters"
        button and its mobile-bar counterpart), matching
        collection-filter.js's convention, since collection-filter.js
        and this file are meant to read the same way. Renaming avoids
        a collision: search-filter.liquid's accordion buttons used to
        use data-filter-toggle themselves before this file existed.

   ASSUMPTIONS -- not yet confirmed against files I haven't seen.
   Flagged so they're easy to grep for and fix:
     - ASSUMPTION: toolbar filter-toggle buttons (rendered in
       snippets/search-toolbar.liquid) carry a data-filter-toggle
       attribute, the same way collection's toolbar buttons do.
     - ASSUMPTION: the active-filter pills container (also rendered in
       search-toolbar.liquid) has id="search-active-filters".
     - ASSUMPTION: the results wrapper rendered by
       snippets/search-results.liquid has id="search-feed".
   If any of these don't match, update the selectors below rather than
   the markup, since the ids/attributes described above are this
   file's contract with those other snippets. */

(function () {
  'use strict';

  var filterPanel   = document.getElementById('search-filter');
  var filterToggles = document.querySelectorAll('[data-filter-toggle]');

  if (!filterPanel) return;

  var backdrop = document.querySelector('.search-mobile-backdrop');

  /* ── Mobile backdrop (self-contained, no main-search.js global) ── */
  function showBackdrop(onClick) {
    if (!backdrop) return;
    backdrop.classList.add('is-visible');
    backdrop.addEventListener('click', onClick, { once: true });
  }

  function hideBackdrop() {
    if (!backdrop) return;
    backdrop.classList.remove('is-visible');
  }

  /* ── Open / close the whole panel ─────────────────────────── */
  function openFilter() {
    filterPanel.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    filterToggles.forEach(function (t) {
      t.setAttribute('aria-expanded', 'true');
    });
    showBackdrop(closeFilter);
  }

  function closeFilter() {
    filterPanel.setAttribute('hidden', '');
    document.body.style.overflow = '';
    filterToggles.forEach(function (t) {
      t.setAttribute('aria-expanded', 'false');
    });
    hideBackdrop();
  }

  /* ── Panel-level toggle buttons (toolbar + mobile bar) ───────
     Same open/close on both mobile and desktop -- unlike
     collection-filter.js, there's no separate desktop-only
     collapse behavior to branch on here: [hidden] + flexbox handles
     the desktop reflow on its own, so a single code path covers
     both breakpoints. */
  filterToggles.forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      filterPanel.hasAttribute('hidden') ? openFilter() : closeFilter();
    });
  });

  /* ── Mobile close button (already in the markup, not injected) ──
     search-filter.liquid renders its own header + close button
     directly (self-contained CSS/markup), so unlike
     collection-filter.js there's nothing to create here -- just wire
     up the click. */
  var closeBtn = filterPanel.querySelector('[data-filter-close]');
  if (closeBtn) closeBtn.addEventListener('click', closeFilter);

  /* ── Group accordion (chevron / aria-expanded) ───────────────
     Delegated on the panel itself, so it keeps working after
     applyFiltersLive() below replaces filterForm's innerHTML --
     no rebinding needed for this one, unlike the checkbox/number
     listeners in bindFilterFieldListeners(). */
  filterPanel.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-filter-group-toggle]');
    if (!toggle || !filterPanel.contains(toggle)) return;

    var expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));

    var body = document.getElementById(toggle.getAttribute('aria-controls'));
    if (body) body.hidden = expanded;
  });

  /* ── Live filtering (AJAX via Section Rendering API) ─────────
     Checking/unchecking a filter (or changing a price field)
     re-fetches just this section's HTML with the new query params
     and swaps in the updated results grid + filter sidebar, with no
     full page reload. Unchecking a filter is just another change
     event, so it live-reverts the same way.

     Falls back to a normal full-page navigation if fetch fails, or if
     JS never runs at all (the form's method="get" + inputs' name
     attributes still work as plain query params). ────────────── */

  var filterForm         = document.getElementById('SearchFilterForm');
  var sectionRoot         = document.getElementById('main-search');
  var sectionId           = sectionRoot ? sectionRoot.dataset.sectionId : null;
  var filterRequestToken  = 0;

  function buildFilterUrl() {
    // Preserve sort_by from the CURRENT url before rebuilding the
    // query string from the filter form, so applying a filter never
    // resets sort back to default. sort_by lives in the toolbar's
    // <select>, outside filterForm, so FormData below won't include
    // it on its own.
    var currentUrl     = new URL(window.location.href);
    var existingSortBy = currentUrl.searchParams.get('sort_by');

    var url = new URL(window.location.href);
    url.search = '';

    new FormData(filterForm).forEach(function (val, key) {
      // Skip blank values (e.g. an untouched price field with no
      // value set) -- submitting an empty min/max param can cause the
      // storefront to treat the range as effectively zero, filtering
      // out products that should still match. filterForm's hidden q
      // and type inputs come along here too, so active search term
      // and Products/Articles tab are preserved without any extra
      // handling.
      if (val === '') return;
      url.searchParams.append(key, val);
    });

    if (existingSortBy && !url.searchParams.has('sort_by')) {
      url.searchParams.set('sort_by', existingSortBy);
    }

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
     Keeps the min/max number inputs, the two-thumb <input
     type="range"> slider, and the bracket radios all in sync. The
     number inputs stay the source of truth for what actually gets
     submitted -- the slider and radios just write into them and then
     dispatch a 'change' event, which bindFilterFieldListeners() above
     already wires up to applyFiltersLive(). Needs re-running after
     every AJAX swap since the form's innerHTML (and therefore these
     elements) gets replaced. ───────────────────────────────────── */
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

      // Number inputs -> slider (typing in min/max moves the thumbs)
      function fieldsToSlider() {
        var lo = minInput.value === '' ? 0 : parseFloat(minInput.value);
        var hi = maxInput.value === '' ? rangeMax : parseFloat(maxInput.value);
        minThumb.value = lo;
        maxThumb.value = hi;
        paintTrack();
      }

      // Slider -> number inputs (dragging a thumb updates min/max)
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
      // No section id available (e.g. template markup out of date) --
      // fall back to the old full-page-reload behavior rather than
      // silently doing nothing.
      window.location.href = displayUrl.toString();
      return;
    }

    var fetchUrl = new URL(displayUrl.toString());
    fetchUrl.searchParams.set('section_id', sectionId);

    var thisRequest = ++filterRequestToken;
    // ASSUMPTION: the results wrapper rendered by search-results.liquid
    // has id="search-feed" (mirrors collection's #product-feed). If
    // it's actually a different id, update this selector.
    var feed = document.getElementById('search-feed');
    filterForm.setAttribute('aria-busy', 'true');
    if (feed) feed.classList.add('is-loading');

    fetch(fetchUrl.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('Filter request failed');
        return res.text();
      })
      .then(function (html) {
        // Another change happened while this request was in flight --
        // drop this (now-stale) response instead of overwriting newer
        // results with older ones.
        if (thisRequest !== filterRequestToken) return;

        var doc = new DOMParser().parseFromString(html, 'text/html');

        var newFeed = doc.getElementById('search-feed');
        var currentFeed = document.getElementById('search-feed');
        if (newFeed && currentFeed) {
          currentFeed.replaceWith(newFeed);
        }

        // ASSUMPTION: the active-filter pills container (rendered in
        // search-toolbar.liquid) has id="search-active-filters". If
        // it's actually a different id, update this selector.
        var newActiveFilters = doc.getElementById('search-active-filters');
        var currentActiveFilters = document.getElementById('search-active-filters');
        if (newActiveFilters && currentActiveFilters) {
          currentActiveFilters.replaceWith(newActiveFilters);
        }

        var newFilterForm = doc.getElementById('SearchFilterForm');
        if (newFilterForm) {
          // Swap in the refreshed filter markup (updated counts,
          // active pills, disabled options) and rebind listeners,
          // since the old input elements were just replaced. The
          // accordion listener doesn't need rebinding -- it's
          // delegated on filterPanel, above.
          filterForm.innerHTML = newFilterForm.innerHTML;
          bindFilterFieldListeners();
          initPriceFilters(filterForm);
        }

        var newPagination = doc.querySelector('.pagination');
        var currentPagination = document.querySelector('.pagination');
        if (currentPagination) currentPagination.remove();
        if (newPagination) {
          var productsPanel = document.querySelector('.search-feed__panel[data-panel="products"]');
          if (productsPanel) productsPanel.appendChild(newPagination);
        }

        if (pushHistory) {
          history.pushState({ type: displayUrl.searchParams.get('type') }, '', displayUrl.toString());
        }

        filterForm.removeAttribute('aria-busy');
        if (feed) feed.classList.remove('is-loading');
      })
      .catch(function () {
        // Network error, bad response, etc. -- don't leave the user
        // stuck with a half-applied filter and a dimmed grid.
        window.location.href = displayUrl.toString();
      });
  }

  bindFilterFieldListeners();
  initPriceFilters(filterForm);

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
  window.SearchFilter = { close: closeFilter };

})();