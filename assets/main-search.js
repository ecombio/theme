/* assets/main-search.js
   Owned by sections/main-search.liquid.

   This file was previously retired, then briefly revived to hold the
   filter-drawer/live-filtering logic merged in from assets/search-
   filter.js, then merged again with assets/search-toolbar.js (was
   owned by snippets/search-toolbar.liquid). This merge folds in a
   third, previously separate file, assets/search-results.js (was
   owned by snippets/search-results.liquid, which itself had already
   inlined the formerly-separate product-results.liquid and article-
   results.liquid snippets/scripts). This is now the single script
   for the whole search page. It's laid out as independent IIFEs
   below rather than one combined block, since several of them bail
   out early when their target element isn't on the page (filters
   disabled, or the Products/Articles panel not being the active
   one) — merging everything into one function would make unrelated
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
      - Live filtering (AJAX via the Section Rendering API): checking
        a filter or editing a price field re-fetches just the
        main-search section's HTML with the new query params and
        swaps in the updated product grid, filter form, pagination,
        and result count — no full page reload. Ported from
        main-collection's collection-filter.js, which does the same
        thing for the collection page's product-filter form; see that
        file for the original.
      - TAB-SWITCH-AWARE REBINDING (2026-07): the toolbar IIFE below
        now also switches tabs via AJAX. When it does, it replaces
        #search-filter's contents wholesale (Products shows the
        filter <form>, Articles shows a placeholder — see main-
        search.liquid), which destroys and recreates the form node.
        initFilterForm() re-runs every time that happens (via the
        'mainsearch:filter-aside-updated' event dispatched by the
        toolbar IIFE), re-querying for the form and re-binding if it's
        there, and no-oping harmlessly if it isn't (Articles tab).
        This replaces the old one-time "if (!filterForm) return"
        setup, which only ever ran once against whatever tab happened
        to be active on the initial page load.
      - CLOSE BUTTON FIX (2026-07): for the same reason, the filter-
        close button's click handling is delegated on `document`
        rather than bound directly to the button — that button lives
        INSIDE #search-filter, so it gets destroyed and recreated on
        every AJAX tab switch too. Delegation survives that with no
        rebinding step needed. The filter-toggle buttons and the
        backdrop live OUTSIDE #search-filter (toolbar / mobile bar /
        section root) and are never replaced, so they keep their
        original direct bindings.

   2. Sort <select> + tab switching (formerly search-toolbar.js):
      - TAB SWITCHING IS NOW LIVE (2026-07): tabs used to be plain
        links to ?type=product|article with no interception at all —
        every switch was a full page navigation, which was the single
        biggest source of "this page feels like it's constantly
        refreshing." This now intercepts the click and re-fetches just
        this section's HTML (the same Section Rendering API mechanism
        the live-filtering above already uses) and patches the result
        in — see the toolbar IIFE for the full breakdown of what gets
        swapped. It still falls back to a normal full-page navigation
        if fetch fails, if there's no section id or #search-feed to
        work with, or if JS never runs at all — every tab is still a
        real <a href> to ?type=product|article underneath, so plain
        navigation keeps working exactly as before with JS off.
      - The sort <select>'s change handling is delegated on `document`
        rather than bound directly to the element, since the AJAX tab
        switch replaces .search-toolbar__sort's contents every time
        the active tab changes (visibility and the selected option
        both depend on active_type).
      - Arrow-key navigation between the Products/Articles tabs still
        follows the WAI-ARIA "Tabs" pattern (Left/Right/Home/End move
        focus + roving tabindex) and still never intercepts Enter/
        Space itself — activating a focused tab is just a normal click
        on the underlying <a>, which the tab-switch handler below
        picks up like any other click.

   3. Scroll-restore for both result grids (formerly search-
      results.js, which had itself already absorbed product-
      results.js and article-results.js): remembers scroll position
      within whichever grid the shopper clicked into (a product, a
      quick-view trigger, an article), so the browser back button
      restores them to where they were instead of dropping them back
      at the top of the results.
      - DELEGATION FIX (2026-07): the click listener for each grid is
        now delegated on the stable #search-feed wrapper (present
        regardless of which tab is active) instead of bound directly
        to #search-results-grid / #search-articles-grid. An AJAX tab
        switch (see above) can create either grid for the first time
        client-side, well after this script first ran, if the page
        originally loaded on the OTHER tab — a direct binding at load
        time would have missed a grid that didn't exist yet.
      - STORAGE KEY FIX (2026-07): the sessionStorage key is now
        computed at click/pageshow time instead of once when the
        script first loads, since window.location.search can change
        via pushState (from an AJAX tab switch or filter change)
        without a real reload — a key computed once up front would
        silently go stale the moment that happened.
      - The two grids still get separate IIFEs, load guards, and
        sessionStorage key prefixes so they stay fully independent —
        each one's #search-feed lookup simply no-ops (via the early
        `if (!feed) return`) if that wrapper isn't on the page at all.
*/
(function () {
  if (window.__searchFilterLoaded) return;
  window.__searchFilterLoaded = true;

  var filterAside = document.getElementById('search-filter');
  if (!filterAside) return; // filters disabled for this merchant — nothing to wire up, ever

  var backdrop = document.querySelector('.search-mobile-backdrop');
  var filterToggles = document.querySelectorAll('[data-filter-toggle]');

  // BACKDROP FIX (2026-07): the drawer/backdrop treatment is a mobile-
  // only pattern — on desktop the filter aside is just a normal
  // in-flow sidebar (see the flexbox layout in main-search.css), so
  // dimming the whole page behind it doesn't make sense there. This
  // mirrors the `max-width: 768px` breakpoint main-search.css already
  // uses to switch .search-filter into its fixed/drawer positioning,
  // so "is it a drawer right now" stays in sync between the CSS and
  // the JS instead of drifting apart.
  function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function setToggleState(expanded) {
    filterToggles.forEach(function (btn) {
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function openFilters() {
    filterAside.hidden = false;
    setToggleState(true);
    // Only add the dimming overlay when the aside is actually behaving
    // like a drawer (mobile). On desktop this just toggles the sidebar
    // in place with no overlay.
    if (backdrop && isMobileViewport()) backdrop.classList.add('is-visible');
  }

  function closeFilters() {
    filterAside.hidden = true;
    setToggleState(false);
    // Safe to always remove, even on desktop where it was never added.
    if (backdrop) backdrop.classList.remove('is-visible');
  }

  filterToggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (filterAside.hidden) {
        openFilters();
      } else {
        closeFilters();
      }
    });
  });

  // CLOSE BUTTON FIX (2026-07): delegated instead of bound directly to
  // the button — see the file header for why. Safe to leave delegated
  // on `document` permanently rather than only after a tab switch,
  // since it behaves identically to a direct binding until the first
  // swap ever happens.
  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-filter-close]')) closeFilters();
  });

  if (backdrop) backdrop.addEventListener('click', closeFilters);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeFilters();
  });

  // If the viewport crosses the mobile breakpoint while the drawer is
  // open (e.g. rotating a tablet, or resizing a desktop window down
  // and back up), drop a stale backdrop rather than leaving the page
  // dimmed once it's no longer behaving like a drawer.
  window.addEventListener('resize', function () {
    if (backdrop && !isMobileViewport()) {
      backdrop.classList.remove('is-visible');
    }
  });

  /* ── Live filtering (AJAX via Section Rendering API) ──────────
     Checking/unchecking a filter (or changing a price field)
     re-fetches just this section's HTML with the new query params
     and swaps in the updated product grid + filter form + pagination
     + result count, with no full page reload. Unchecking a filter is
     just another change event, so it live-reverts the same way.

     Falls back to a normal full-page navigation if fetch fails, if
     there's no section id to fetch with, or if JS never runs at all
     (the form's method="get" + inputs' name attributes still work as
     plain query params). ─────────────────────────────────────────── */
  var filterForm = null;
  var sectionRoot = document.getElementById('main-search');
  var sectionId = sectionRoot ? sectionRoot.dataset.sectionId : null;
  var filterRequestToken = 0;

  function buildFilterUrl() {
    // Preserve sort_by from the CURRENT url before rebuilding the
    // query string from the filter form, so applying a filter never
    // resets sort back to default. (q and type don't need the same
    // treatment — they're already hidden inputs inside the form.)
    var currentUrl = new URL(window.location.href);
    var existingSortBy = currentUrl.searchParams.get('sort_by');

    var url = new URL(window.location.href);
    url.search = '';

    new FormData(filterForm).forEach(function (val, key) {
      // Skip blank values (e.g. an untouched price field) — an empty
      // filter.v.price.gte/lte param can cause the storefront to
      // treat the range as effectively zero, filtering out products
      // that should still match.
      if (val === '') return;
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

  function applyFiltersLive(pushHistory) {
    var displayUrl = buildFilterUrl();

    if (!sectionId) {
      // No section id available — fall back to a full-page reload
      // rather than silently doing nothing.
      window.location.href = displayUrl.toString();
      return;
    }

    var fetchUrl = new URL(displayUrl.toString());
    fetchUrl.searchParams.set('section_id', sectionId);

    var thisRequest = ++filterRequestToken;
    var grid = document.getElementById('search-results-grid');
    // aria-busy also drives the visual loading state (dimmed fields +
    // spinner) via CSS in main-search.css — this used to only dim the
    // results grid, leaving the filter form itself looking idle/
    // interactive while a request was actually in flight.
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

        // Swap the grid's CONTENTS in place rather than replacing the
        // grid node itself. The scroll-restore IIFEs at the bottom of
        // this file listen on a stable ancestor rather than this node
        // directly, but keeping the node itself steady here still
        // avoids any other assumptions (add-to-cart, quick view, etc.)
        // about this element's identity breaking on every filter change.
        var newGrid = doc.getElementById('search-results-grid');
        var currentGrid = document.getElementById('search-results-grid');
        if (newGrid && currentGrid) {
          currentGrid.innerHTML = newGrid.innerHTML;
          var newStyle = newGrid.getAttribute('style');
          if (newStyle) currentGrid.setAttribute('style', newStyle);
        }

        var newFilterForm = doc.getElementById('SearchFilterForm');
        if (newFilterForm) {
          // Swap in the refreshed filter markup (updated counts,
          // active pills, disabled options) and rebind listeners,
          // since the old input elements were just replaced.
          filterForm.innerHTML = newFilterForm.innerHTML;
          bindFilterFieldListeners();
        }

        var productsPanel = document.getElementById('panel-products');
        var newPagination = doc.querySelector('#panel-products .pagination');
        var currentPagination = productsPanel ? productsPanel.querySelector('.pagination') : null;
        if (currentPagination) currentPagination.remove();
        if (newPagination && productsPanel) productsPanel.appendChild(newPagination);

        var newCount = doc.getElementById('search-result-count');
        var currentCount = document.getElementById('search-result-count');
        if (newCount && currentCount) currentCount.replaceWith(newCount);

        if (pushHistory) {
          history.pushState({}, '', displayUrl.toString());
        }

        filterForm.removeAttribute('aria-busy');
      })
      .catch(function () {
        // Network error, bad response, etc. — don't leave the user
        // stuck with a half-applied filter and a dimmed grid. Only if
        // this is still the most recent request; an older, superseded
        // one failing shouldn't stomp on a newer one that's still in
        // flight or already succeeded.
        if (thisRequest !== filterRequestToken) return;
        window.location.href = displayUrl.toString();
      });
  }

  function initFilterForm() {
    filterForm = document.getElementById('SearchFilterForm');
    if (!filterForm) return; // Articles tab (or filters disabled) — nothing further to wire up

    bindFilterFieldListeners();

    // Keep the Apply button / Enter-key submit working (e.g. after
    // typing in a price field and pressing Enter), routed through the
    // same live path instead of a full navigation.
    filterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      applyFiltersLive(true);
    });
  }

  initFilterForm();

  // Re-run whenever the toolbar IIFE's AJAX tab switch drops a fresh
  // copy of #search-filter's contents into the page (form <-> Articles
  // placeholder) — see the file header's "TAB-SWITCH-AWARE REBINDING"
  // note for why this can't just be a one-time setup anymore.
  document.addEventListener('mainsearch:filter-aside-updated', initFilterForm);

  // Back/forward support now lives in the toolbar IIFE's single
  // popstate listener below, which re-syncs the whole section (tabs,
  // filters, sort, results, count) against the current URL — a
  // superset of "just re-apply filters," so it's handled there instead
  // of duplicated here.
})();

(function () {
  if (window.__searchToolbarLoaded) return;
  window.__searchToolbarLoaded = true;

  // SORT FIX (2026-07): delegated on document instead of bound
  // directly to the <select> — see the file header for why (the AJAX
  // tab switch below replaces .search-toolbar__sort's contents on
  // every tab change).
  document.addEventListener('change', function (event) {
    if (event.target.id !== 'SortBy') return;
    var url = new URL(window.location.href);
    url.searchParams.set('sort_by', event.target.value);
    window.location.href = url.toString();
  });

  /* ── Tab switching (AJAX via Section Rendering API) ────────────────
     See the file header's "TAB SWITCHING IS NOW LIVE" note for the
     rationale. This re-fetches just this section's HTML for the
     target tab's URL and patches in:
       - the active tab's classes/aria-selected/tabindex + which panel
         is visible (setActiveType)
       - both result panels' grids + pagination (syncPanel) — patched
         in place if the grid already exists client-side, or dropped
         in whole the first time a panel is populated, since Liquid
         never renders the INACTIVE panel's contents at all (not even
         hidden — genuinely absent)
       - the filter aside's contents (form <-> Articles placeholder)
       - the sort <select> (contents + visibility) and the mobile sort
         button's disabled state
       - the "N results for..." count

     The "Switch to Products" link inside the Articles-tab filter
     placeholder (search-filter__placeholder-btn, in main-search.liquid)
     goes through this same path — it carries the same data-type
     attribute as the two real tabs purely so one delegated click
     handler can pick up all three, since it's functionally the same
     action as clicking the Products tab. ──────────────────────────── */
  var sectionRoot = document.getElementById('main-search');
  var sectionId = sectionRoot ? sectionRoot.dataset.sectionId : null;
  var searchFeed = document.getElementById('search-feed');
  var tabRequestToken = 0;

  function setActiveType(type) {
    var page = document.querySelector('[data-search-page]');
    if (page) page.dataset.activeType = type;

    document.querySelectorAll('.tab-switcher__tab').forEach(function (tab) {
      var isActive = tab.dataset.type === type;
      tab.classList.toggle('tab-switcher__tab--active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
    });
  }

  function syncPanel(doc, panelId, gridId, panelType, activeType) {
    var newPanel = doc.getElementById(panelId);
    var currentPanel = document.getElementById(panelId);
    if (!newPanel || !currentPanel) return;

    var currentGrid = document.getElementById(gridId);
    var newGrid = newPanel.querySelector('#' + gridId);

    if (currentGrid && newGrid) {
      // Grid already exists client-side (this panel has been
      // rendered before, either at page load or an earlier switch) —
      // patch its contents/style and swap the pagination in place,
      // same reasoning as the filter live-update above: this keeps
      // the grid CONTAINER's own node identity stable, which the
      // scroll-restore IIFEs at the bottom of this file rely on.
      currentGrid.innerHTML = newGrid.innerHTML;
      var newStyle = newGrid.getAttribute('style');
      if (newStyle) currentGrid.setAttribute('style', newStyle);

      var currentPagination = currentPanel.querySelector('.pagination');
      var newPagination = newPanel.querySelector('.pagination');
      if (currentPagination) currentPagination.remove();
      if (newPagination) currentPanel.appendChild(newPagination);
    } else {
      // This panel has never held content client-side before — e.g.
      // the page originally loaded on the OTHER tab, so Liquid never
      // rendered anything inside it at all. Nothing to patch yet, so
      // drop in the whole rendered panel body once. Still safe for
      // scroll-restore: those listeners are delegated on the stable
      // #search-feed wrapper rather than bound to the grid node
      // itself, specifically so a grid created after the fact like
      // this still gets picked up.
      currentPanel.innerHTML = newPanel.innerHTML;
    }

    currentPanel.hidden = panelType !== activeType;
  }

  function switchTab(targetUrl, options) {
    options = options || {};
    var pushHistory = options.pushHistory !== false;
    var displayUrl = new URL(targetUrl, window.location.href);

    if (!sectionId || !searchFeed) {
      // No section id to fetch with, or the feed isn't on the page at
      // all — fall back to a normal full-page navigation rather than
      // silently doing nothing.
      window.location.href = displayUrl.toString();
      return;
    }

    var fetchUrl = new URL(displayUrl.toString());
    fetchUrl.searchParams.set('section_id', sectionId);

    var thisRequest = ++tabRequestToken;

    // LOADING-STATE FIX (2026-07): delayed briefly so a fast response
    // never flashes the dimmed/spinner state on for a single frame.
    // Still shows it (and keeps showing it) for anything slower, and
    // is always cleared in .finally() below regardless of how the
    // request resolves.
    var loadingTimer = setTimeout(function () {
      if (thisRequest === tabRequestToken) {
        searchFeed.classList.add('is-loading');
        searchFeed.setAttribute('aria-busy', 'true');
      }
    }, 150);

    fetch(fetchUrl.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('Tab switch request failed');
        return res.text();
      })
      .then(function (html) {
        // Another tab click happened while this request was in
        // flight — drop this (now-stale) response instead of
        // overwriting newer results with older ones.
        if (thisRequest !== tabRequestToken) return;

        var doc = new DOMParser().parseFromString(html, 'text/html');
        var pageEl = doc.querySelector('[data-search-page]');
        var newActiveType = pageEl ? pageEl.dataset.activeType : 'product';

        setActiveType(newActiveType);
        syncPanel(doc, 'panel-products', 'search-results-grid', 'product', newActiveType);
        syncPanel(doc, 'panel-articles', 'search-articles-grid', 'article', newActiveType);

        var newSortWrap = doc.querySelector('.search-toolbar__sort');
        var currentSortWrap = document.querySelector('.search-toolbar__sort');
        if (newSortWrap && currentSortWrap) {
          currentSortWrap.innerHTML = newSortWrap.innerHTML;
          currentSortWrap.setAttribute('style', newSortWrap.getAttribute('style') || '');
        }

        var newMobileSortBtn = doc.querySelector('[data-mobile-sort-toggle]');
        var currentMobileSortBtn = document.querySelector('[data-mobile-sort-toggle]');
        if (newMobileSortBtn && currentMobileSortBtn) {
          currentMobileSortBtn.disabled = newMobileSortBtn.disabled;
        }

        // Filter aside: swap contents (form <-> Articles placeholder)
        // and let the filter IIFE re-wire live filtering (or no-op)
        // against whatever's there now — it owns that logic.
        var newFilterAside = doc.getElementById('search-filter');
        var currentFilterAside = document.getElementById('search-filter');
        if (newFilterAside && currentFilterAside) {
          currentFilterAside.innerHTML = newFilterAside.innerHTML;
          document.dispatchEvent(new CustomEvent('mainsearch:filter-aside-updated'));
        }

        var newCount = doc.getElementById('search-result-count');
        var currentCount = document.getElementById('search-result-count');
        if (newCount && currentCount) currentCount.replaceWith(newCount);

        if (pushHistory) {
          history.pushState({}, '', displayUrl.toString());
        }

        // If the shopper has scrolled past the toolbar, bring it back
        // into view — roughly matching what a full page navigation
        // would have done (started at the top) — without yanking the
        // scroll position around when it's already visible.
        var toolbar = document.getElementById('search-toolbar');
        if (toolbar && toolbar.getBoundingClientRect().top < 0) {
          toolbar.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      })
      .catch(function () {
        // Network error, bad response, etc. — don't leave the user
        // stuck on a half-switched, dimmed feed. Only if this is
        // still the most recent request.
        if (thisRequest !== tabRequestToken) return;
        window.location.href = displayUrl.toString();
      })
      .finally(function () {
        clearTimeout(loadingTimer);
        if (thisRequest === tabRequestToken) {
          searchFeed.classList.remove('is-loading');
          searchFeed.removeAttribute('aria-busy');
        }
      });
  }

  document.addEventListener('click', function (event) {
    // Let modified/non-primary clicks (open in new tab, etc.) behave
    // exactly like a normal link — only intercept a plain left click.
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    var link = event.target.closest('a[data-type]');
    if (!link) return;
    if (!link.closest('.tab-switcher') && !link.closest('.search-filter__placeholder')) return;
    if (link.classList.contains('tab-switcher__tab--active')) return; // already on this tab

    event.preventDefault();
    switchTab(link.href, { pushHistory: true });
  });

  // Back/forward support. Always re-syncs the WHOLE section (tabs,
  // filters, sort, results, count) against whatever the URL says,
  // rather than trying to guess whether the user stepped back through
  // a tab change or a filter change — safe either way, since this is
  // a superset of what either one needs on its own.
  window.addEventListener('popstate', function () {
    switchTab(window.location.href, { pushHistory: false });
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

/* ------------------------------------------------------------------
   formerly: product-results.js (via search-results.js)

   Remembers scroll position within the product grid so that using
   the browser back button (after opening a product or quick view)
   restores the shopper to where they were, instead of dropping them
   back at the top of the results.
   ------------------------------------------------------------------ */
(function () {
  if (window.__productResultsLoaded) return;
  window.__productResultsLoaded = true;

  var feed = document.getElementById('search-feed');
  if (!feed) return;

  // DELEGATION + STORAGE KEY FIX (2026-07): see the file header for
  // why this is delegated on #search-feed (stable, always present)
  // rather than bound directly to #search-results-grid, and why the
  // storage key is computed fresh here rather than once at load.
  feed.addEventListener('click', function (event) {
    if (!event.target.closest('#search-results-grid')) return;
    if (event.target.closest('a, [data-atc-btn], [data-quickview-btn]')) {
      var storageKey = 'productResultsScroll:' + window.location.pathname + window.location.search;
      sessionStorage.setItem(storageKey, String(window.scrollY));
    }
  });

  window.addEventListener('pageshow', function () {
    var storageKey = 'productResultsScroll:' + window.location.pathname + window.location.search;
    var savedY = sessionStorage.getItem(storageKey);
    if (savedY !== null) {
      window.scrollTo(0, parseInt(savedY, 10));
      sessionStorage.removeItem(storageKey);
    }
  });
})();

/* ------------------------------------------------------------------
   formerly: article-results.js (via search-results.js)

   Same scroll-restore behavior as above, scoped to the article grid,
   so returning from an article via the back button lands the
   shopper back where they were.
   ------------------------------------------------------------------ */
(function () {
  if (window.__articleResultsLoaded) return;
  window.__articleResultsLoaded = true;

  var feed = document.getElementById('search-feed');
  if (!feed) return;

  // See the DELEGATION + STORAGE KEY FIX note in the product-results
  // IIFE above — same reasoning, scoped to the article grid.
  feed.addEventListener('click', function (event) {
    if (!event.target.closest('#search-articles-grid')) return;
    if (event.target.closest('a')) {
      var storageKey = 'articleResultsScroll:' + window.location.pathname + window.location.search;
      sessionStorage.setItem(storageKey, String(window.scrollY));
    }
  });

  window.addEventListener('pageshow', function () {
    var storageKey = 'articleResultsScroll:' + window.location.pathname + window.location.search;
    var savedY = sessionStorage.getItem(storageKey);
    if (savedY !== null) {
      window.scrollTo(0, parseInt(savedY, 10));
      sessionStorage.removeItem(storageKey);
    }
  });
})();