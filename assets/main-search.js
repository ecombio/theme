/* assets/main-search.js
   Owned by sections/main-search.liquid.

   This file was previously retired, then briefly revived to hold the
   filter-drawer/live-filtering logic merged in from assets/search-
   filter.js, then merged again with assets/search-toolbar.js (was
   owned by snippets/search-toolbar.liquid).

   SCROLL-RESTORE SPLIT BACK OUT (2026-07): the third responsibility
   this file briefly held — scroll-restore for both result grids —
   has moved to assets/search-results.js, loaded directly by
   snippets/search-results.liquid, mirroring the CSS split done in
   the same pass. This file now owns only the filter drawer/live-
   filtering and toolbar (sort + tab keyboard nav) behavior described
   below.

   MOBILE DRAWER: HIDDEN BY DEFAULT / SLIDE-IN (2026-07-25): openFilters()
   and closeFilters() below now add/remove an `is-open` class on the
   filter <aside> in addition to (on desktop only) toggling the
   native `hidden` attribute. This split exists because the two
   breakpoints need different behavior:
     - Desktop: the aside is a permanent sidebar; opening/closing it
       is an instant collapse/expand, handled by toggling `hidden`
       (assets/main-search.css's FLEXBOX FIX makes the feed reflow to
       fill the space on its own when the aside is hidden).
     - Mobile: the aside is a slide-in drawer. assets/search-filter.css
       keeps it permanently translated off-screen by default
       (regardless of the `hidden` attribute's state -- see that
       file's HIDDEN-BY-DEFAULT / SLIDE-IN DRAWER note) and only
       slides it on-screen when `.is-open` is present. Toggling the
       native `hidden` attribute on mobile would force `display: none`
       instantly and defeat the slide transition entirely, so mobile
       never touches `hidden` -- only the class.
   isMobileViewport() (already used for the backdrop) decides which
   path each call takes.

   Laid out as independent IIFEs below rather than one combined
   block, since each bails out early when its target element isn't on
   the page (filters disabled, or a control not present on this
   page) — merging everything into one function would make unrelated
   behaviors incorrectly depend on each other's markup existing.

   Responsibilities:

   1. Filter drawer + live filtering (formerly search-filter.js):
      - Opening/closing the drawer: the toggle buttons live in the
        section toolbar/mobile bar, the backdrop element lives in the
        section markup too — this owns all of that behavior since
        it's all "does the filter drawer show or not."
      - The dimming backdrop is a MOBILE-ONLY drawer affordance (see
        isMobileViewport() below) — it no longer appears on desktop,
        where the filter aside is just a normal in-flow sidebar.
      - Price filter UI (2026-07): the price_range group now renders
        a histogram + dual-thumb slider + quick-pick brackets
        (initPriceFilters(), below), not just two plain number
        inputs. The number inputs stay the source of truth for what
        gets submitted; the slider/radios just write into them and
        dispatch 'change', which the live-filtering listeners already
        handle. Needs re-running after every AJAX swap since the
        form's innerHTML (and therefore these elements) gets
        replaced.
      - Live filtering (AJAX via the Section Rendering API): checking
        a filter or editing a price field re-fetches just the
        main-search section's HTML with the new query params and
        swaps in the updated product grid, filter form, pagination,
        and result count — no full page reload. Ported from
        main-collection's collection-filter.js, which does the same
        thing for the collection page's product-filter form; see that
        file for the original. Differences here:
          - This form already carries `q` and `type` as hidden inputs
            (collection's form didn't need either, since
            collection.url is already scoped to one collection), so
            FormData picks them up for free — no separate "preserve
            q/type" step.
          - Filters only ever render on the Products tab (Shopify has
            no faceted search for articles), so this bails out early
            if the filter <form> isn't present at all — no
            live-filtering setup needed on the Articles tab.
          - Tab switching itself is NOT live here (unlike
            collection's tab switching, which collection-feed.js does
            intercept) — search's tabs are deliberately plain links
            to ?type=product|article, per responsibility #2 below.
            This only makes the FILTER FORM's fields live; it never
            touches tab navigation. IMPORTANT: because of this, the
            filterForm/sectionId references below are captured once
            at load and assumed to stay attached to the live DOM for
            the rest of the page's life. If tab navigation is ever
            made AJAX (replacing #main-search wholesale) without also
            reworking this file to re-acquire those references after
            the swap, live filtering will silently start writing into
            detached, disconnected elements. Do not add AJAX tab
            switching without addressing this.
          - Also swaps the hero's result count ("N results for
            'query'") since that changes as filters narrow the
            results, which collection's hero text doesn't have an
            equivalent of.
          - Also swaps the toolbar's active-filter pills
            (.search-toolbar__active, rendered by search-toolbar.liquid)
            (2026-07 fix): this block previously only updated on a
            full page reload, since applyFiltersLive's swap list never
            included anything from search-toolbar.liquid's markup —
            checking a filter would update the grid/count/form but
            leave stale (or missing) pills in the toolbar until the
            user manually refreshed. syncActivePills() below handles
            all three cases a fetch can produce: pills existed and
            still do (replace), pills didn't exist and now do (first
            filter applied — insert after the tab switcher), and
            pills existed but no longer do (last filter cleared —
            remove).
          - The price_bracket radios are UI-only (they just write
            into the min./max. number fields, see initPriceFilters)
            and are explicitly excluded from the submitted query
            params in buildFilterUrl — submitting a `price_bracket`
            param wouldn't mean anything to the storefront filter
            engine.

   2. Sort <select> + tab keyboard navigation (formerly
      search-toolbar.js): the sort <select> redirects with an updated
      sort_by param, and arrow-key navigation between the Products/
      Articles tabs follows the WAI-ARIA "Tabs" pattern (Left/Right/
      Home/End move focus + roving tabindex). Deliberately does NOT
      intercept the tab links' click/Enter navigation itself — each
      tab is a real link to ?type=product|article, which is the
      simplest, most reliable way to hand off to Shopify's own
      pagination/filter state for that result type. This only
      enhances keyboard travel between the two tabs; it never blocks
      the default navigation.

      NOTE (2026-07): assets/search-toolbar.js still exists as a
      separate file and snippets/search-toolbar.liquid still loads it
      via its own <script> tag, even though its responsibilities were
      merged into this IIFE. Both files guard with the same flag name
      (window.__searchToolbarLoaded) — whichever script tag executes
      first "wins" and the other's setup silently never runs. This
      predates the pill-sync fix above and is a separate bug: resolve
      by removing search-toolbar.liquid's <script> tag now that this
      file is the single owner of that logic (see accompanying
      search-toolbar.liquid change).
*/
(function () {
  if (window.__searchFilterLoaded) return;
  window.__searchFilterLoaded = true;

  var filterAside = document.getElementById('search-filter');
  if (!filterAside) return;

  var backdrop = document.querySelector('.search-mobile-backdrop');
  var filterToggles = document.querySelectorAll('[data-filter-toggle]');
  var filterClose = document.querySelector('[data-filter-close]');

  function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function setToggleState(expanded) {
    filterToggles.forEach(function (btn) {
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function openFilters() {
    // Mobile: slide-in via class only -- never touch `hidden` here,
    // it would force display:none and skip the transition entirely.
    // Desktop: instant collapse/expand via the `hidden` attribute,
    // as before.
    if (isMobileViewport()) {
      filterAside.classList.add('is-open');
      if (backdrop) backdrop.classList.add('is-visible');
    } else {
      filterAside.hidden = false;
    }
    setToggleState(true);
  }

  function closeFilters() {
    if (isMobileViewport()) {
      filterAside.classList.remove('is-open');
    } else {
      filterAside.hidden = true;
    }
    if (backdrop) backdrop.classList.remove('is-visible');
    setToggleState(false);
  }

  function isFiltersOpen() {
    return isMobileViewport()
      ? filterAside.classList.contains('is-open')
      : !filterAside.hidden;
  }

  filterToggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (isFiltersOpen()) {
        closeFilters();
      } else {
        openFilters();
      }
    });
  });

  if (filterClose) filterClose.addEventListener('click', closeFilters);
  if (backdrop) backdrop.addEventListener('click', closeFilters);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeFilters();
  });

  window.addEventListener('resize', function () {
    if (backdrop && !isMobileViewport()) {
      backdrop.classList.remove('is-visible');
    }
  });

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

      function fieldsToSlider() {
        var lo = minInput.value === '' ? 0 : parseFloat(minInput.value);
        var hi = maxInput.value === '' ? rangeMax : parseFloat(maxInput.value);
        minThumb.value = lo;
        maxThumb.value = hi;
        paintTrack();
      }

      function sliderToFields(commit) {
        var lo = parseFloat(minThumb.value);
        var hi = parseFloat(maxThumb.value);

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

      minThumb.addEventListener('input', function () { sliderToFields(false); });
      maxThumb.addEventListener('input', function () { sliderToFields(false); });
      minThumb.addEventListener('change', function () { sliderToFields(true); });
      maxThumb.addEventListener('change', function () { sliderToFields(true); });

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

  var filterForm = document.getElementById('SearchFilterForm');
  if (!filterForm) return;

  var sectionRoot = document.getElementById('main-search');
  var sectionId = sectionRoot ? sectionRoot.dataset.sectionId : null;
  var filterRequestToken = 0;

  function buildFilterUrl() {
    var currentUrl = new URL(window.location.href);
    var existingSortBy = currentUrl.searchParams.get('sort_by');

    var url = new URL(window.location.href);
    url.search = '';

    new FormData(filterForm).forEach(function (val, key) {
      if (val === '' || key === 'price_bracket') return;
      url.searchParams.append(key, val);
    });

    if (existingSortBy && !url.searchParams.has('sort_by')) {
      url.searchParams.set('sort_by', existingSortBy);
    }

    return url;
  }

  function bindFilterFieldListeners() {
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

  // 2026-07 fix: keeps the toolbar's active-filter pill strip
  // (.search-toolbar__active, from search-toolbar.liquid) in sync
  // with whatever the fetched section actually rendered. Handles all
  // three cases: pills existed and still do (replace in place),
  // pills didn't exist and now do (first filter just got checked —
  // insert right after the tab switcher), and pills existed but no
  // longer do (last filter just got cleared — remove).
  function syncActivePills(doc) {
    var toolbar = document.getElementById('search-toolbar');
    if (!toolbar) return;

    var newActive = doc.querySelector('.search-toolbar__active');
    var currentActive = toolbar.querySelector('.search-toolbar__active');

    if (newActive && currentActive) {
      currentActive.replaceWith(newActive);
    } else if (newActive && !currentActive) {
      var tabSwitcher = toolbar.querySelector('.tab-switcher');
      if (tabSwitcher) {
        tabSwitcher.insertAdjacentElement('afterend', newActive);
      } else {
        toolbar.appendChild(newActive);
      }
    } else if (!newActive && currentActive) {
      currentActive.remove();
    }
  }

  function applyFiltersLive(pushHistory) {
    var displayUrl = buildFilterUrl();

    if (!sectionId) {
      window.location.href = displayUrl.toString();
      return;
    }

    var fetchUrl = new URL(displayUrl.toString());
    fetchUrl.searchParams.set('section_id', sectionId);

    var thisRequest = ++filterRequestToken;
    var grid = document.getElementById('search-results-grid');
    filterForm.setAttribute('aria-busy', 'true');
    if (grid) grid.style.opacity = '0.5';

    fetch(fetchUrl.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('Filter request failed');
        return res.text();
      })
      .then(function (html) {
        if (thisRequest !== filterRequestToken) return;

        var doc = new DOMParser().parseFromString(html, 'text/html');

        var newGrid = doc.getElementById('search-results-grid');
        var currentGrid = document.getElementById('search-results-grid');
        if (newGrid && currentGrid) {
          currentGrid.innerHTML = newGrid.innerHTML;
          var newStyle = newGrid.getAttribute('style');
          if (newStyle) currentGrid.setAttribute('style', newStyle);
        }

        var newFilterForm = doc.getElementById('SearchFilterForm');
        if (newFilterForm) {
          filterForm.innerHTML = newFilterForm.innerHTML;
          bindFilterFieldListeners();
          initPriceFilters(filterForm);
        }

        var productsPanel = document.getElementById('panel-products');
        var newPagination = doc.querySelector('#panel-products .pagination');
        var currentPagination = productsPanel ? productsPanel.querySelector('.pagination') : null;
        if (currentPagination) currentPagination.remove();
        if (newPagination && productsPanel) productsPanel.appendChild(newPagination);

        var newCount = doc.getElementById('search-result-count');
        var currentCount = document.getElementById('search-result-count');
        if (newCount && currentCount) currentCount.replaceWith(newCount);

        syncActivePills(doc);

        if (pushHistory) {
          history.pushState({}, '', displayUrl.toString());
        }

        filterForm.removeAttribute('aria-busy');
      })
      .catch(function () {
        window.location.href = displayUrl.toString();
      });
  }

  bindFilterFieldListeners();
  initPriceFilters(filterForm);

  filterForm.addEventListener('submit', function (e) {
    e.preventDefault();
    applyFiltersLive(true);
  });

  window.addEventListener('popstate', function () {
    applyFiltersLive(false);
  });
})();

(function () {
  if (window.__searchToolbarLoaded) return;
  window.__searchToolbarLoaded = true;

  var sortSelect = document.querySelector('[data-sort]');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sort_by', sortSelect.value);
      window.location.href = url.toString();
    });
  }

  var searchFeed = document.getElementById('search-feed');
  document.querySelectorAll('.tab-switcher__tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      if (tab.classList.contains('tab-switcher__tab--active')) return;
      if (searchFeed) searchFeed.classList.add('is-loading');
    });
  });

  document.addEventListener('keydown', function (event) {
    var tab = event.target.closest('[role="tab"]');
    if (!tab) return;

    var tablist = tab.closest('[role="tablist"]');
    if (!tablist) return;

    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    var index = tabs.indexOf(tab);
    if (index === -1) return;

    var nextIndex = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    tabs.forEach(function (t, i) {
      t.tabIndex = i === nextIndex ? 0 : -1;
    });
    tabs[nextIndex].focus();
  });
})();