/* assets/main-search.js
   Companion to sections/main-search.liquid.

   Unlike main-collection.js's live-filter AJAX (which re-fetches the
   SAME type of content with different filter params), tab switching
   here re-fetches a DIFFERENT type of content entirely (?type=product
   vs ?type=article), because that's the only lever Shopify's search
   object gives us for scoping + paginating results by type. So instead
   of swapping one grid element, a tab switch swaps the whole panel
   (grid + pagination + sort options) for whichever type is now active.

   The tab links and pagination links are real <a href> elements, so
   with JS disabled everything still works via normal navigation. */

(function () {
  'use strict';

  var page = document.querySelector('[data-search-page]');
  if (!page) return;

  var sectionRoot = document.getElementById('main-search');
  var sectionId = sectionRoot ? sectionRoot.dataset.sectionId : null;
  var tabs = page.querySelectorAll('.tab-switcher__tab[data-type]');
  var sortSelect = document.querySelector('[data-sort]');
  var requestToken = 0;

  /* ══════════════════════════════════════════════════════════
     Build a URL for a given type + sort_by, preserving q and
     everything else already on the current URL.
  ══════════════════════════════════════════════════════════ */
  function buildUrl(type, sortBy) {
    var url = new URL(window.location.href);
    url.searchParams.set('type', type);
    if (sortBy) {
      url.searchParams.set('sort_by', sortBy);
    } else if (type !== page.dataset.activeType) {
      // Sort options differ between products and articles — drop any
      // sort_by carried over from the other tab rather than sending
      // a value that may not apply.
      url.searchParams.delete('sort_by');
    }
    url.searchParams.delete('page'); // switching type/sort resets pagination
    return url;
  }

  /* ══════════════════════════════════════════════════════════
     Fetch the section for a given URL and swap in the parts
     that changed: the active panel's grid + pagination, the
     tab active states, and the sort <select>'s option list.
  ══════════════════════════════════════════════════════════ */
  function fetchAndSwap(url, pushHistory) {
    if (!sectionId) {
      window.location.href = url.toString();
      return;
    }

    var fetchUrl = new URL(url.toString());
    fetchUrl.searchParams.set('section_id', sectionId);

    var thisRequest = ++requestToken;
    var feed = document.getElementById('search-feed');
    if (feed) feed.style.opacity = '0.5';

    fetch(fetchUrl.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('Search request failed');
        return res.text();
      })
      .then(function (html) {
        if (thisRequest !== requestToken) return; // stale response

        var doc = new DOMParser().parseFromString(html, 'text/html');
        var newType = url.searchParams.get('type');

        // Swap the ENTIRE feed (both panels) as one unit rather than
        // patching pieces independently. The server already computed
        // the correct hidden/visible state and content for both panels
        // in this one response — grabbing it wholesale means there's
        // no selector-mismatch path that can leave stale content behind
        // while attributes elsewhere get toggled out of sync with it.
        var newFeed = doc.getElementById('search-feed');
        var currentFeed = document.getElementById('search-feed');
        if (!newFeed || !currentFeed) {
          window.location.href = url.toString();
          return;
        }
        currentFeed.replaceWith(newFeed);

        var newSortSelect = doc.querySelector('[data-sort]');
        if (newSortSelect) {
          sortSelect = newSortSelect; // old node was just removed with the old feed
          sortSelect.addEventListener('change', function () {
            fetchAndSwap(buildUrl(page.dataset.activeType, sortSelect.value), true);
          });
        }

        var newResultCount = doc.querySelector('.search-result-count');
        var currentResultCount = document.querySelector('.search-result-count');
        if (newResultCount && currentResultCount) {
          currentResultCount.replaceWith(newResultCount);
        }

        tabs.forEach(function (t) {
          var on = t.dataset.type === newType;
          t.classList.toggle('tab-switcher__tab--active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.setAttribute('tabindex', on ? '0' : '-1');
        });

        page.dataset.activeType = newType;

        if (pushHistory) {
          history.pushState({ type: newType }, '', url.toString());
        }
      })
      .catch(function () {
        // Network error, bad response, etc. — fall back to a real nav
        // rather than leaving the page half-updated.
        window.location.href = url.toString();
      });
  }

  /* ══════════════════════════════════════════════════════════
     Tab clicks
  ══════════════════════════════════════════════════════════ */
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function (e) {
      if (tab.dataset.type === page.dataset.activeType) return;
      e.preventDefault();
      fetchAndSwap(buildUrl(tab.dataset.type, null), true);
    });

    tab.addEventListener('keydown', function (e) {
      var next;
      if (e.key === 'ArrowRight') next = tabs[i + 1] || tabs[0];
      if (e.key === 'ArrowLeft') next = tabs[i - 1] || tabs[tabs.length - 1];
      if (next) {
        next.focus();
        next.click();
      }
    });
  });

  /* ══════════════════════════════════════════════════════════
     Sort select (desktop)
  ══════════════════════════════════════════════════════════ */
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      fetchAndSwap(buildUrl(page.dataset.activeType, sortSelect.value), true);
    });
  }

  /* ══════════════════════════════════════════════════════════
     Mobile sort sheet — built lazily, mirrors the desktop
     #SortBy select so there's a single source of truth.
  ══════════════════════════════════════════════════════════ */
  var mobileSortBtn = document.querySelector('[data-mobile-sort-toggle]');
  var backdrop = document.querySelector('.search-mobile-backdrop');

  if (mobileSortBtn) {
    var sortSheet = null;

    function buildSortSheet() {
      var sheet = document.createElement('div');
      sheet.className = 'mobile-sort-sheet';
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      sheet.setAttribute('aria-label', 'Sort options');

      var inner = '<div class="mobile-sort-sheet__inner">';
      inner += '<div class="mobile-sort-sheet__handle"></div>';
      inner += '<p class="mobile-sort-sheet__heading">Sort by</p>';
      inner += '<ul class="mobile-sort-sheet__list">';

      var desktopSort = document.getElementById('SortBy');
      if (desktopSort) {
        Array.from(desktopSort.options).forEach(function (opt) {
          var active = opt.selected ? ' mobile-sort-sheet__option--active' : '';
          inner +=
            '<li><button class="mobile-sort-sheet__option' + active + '" type="button" ' +
            'data-sort-value="' + opt.value + '">' + opt.text + '</button></li>';
        });
      }

      inner += '</ul></div>';
      sheet.innerHTML = inner;

      sheet.querySelectorAll('[data-sort-value]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          closeSortSheet();
          fetchAndSwap(buildUrl(page.dataset.activeType, btn.dataset.sortValue), true);
        });
      });

      document.body.appendChild(sheet);
      return sheet;
    }

    function openSortSheet() {
      // Rebuild every time so it reflects whatever the active tab's
      // sort options currently are (they differ between product/article).
      if (sortSheet) sortSheet.remove();
      sortSheet = buildSortSheet();
      sortSheet.getBoundingClientRect(); // force reflow before transition
      sortSheet.classList.add('is-open');
      mobileSortBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      if (backdrop) backdrop.classList.add('is-visible');
    }

    function closeSortSheet() {
      if (!sortSheet) return;
      sortSheet.classList.remove('is-open');
      mobileSortBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (backdrop) backdrop.classList.remove('is-visible');
    }

    mobileSortBtn.addEventListener('click', function () {
      sortSheet && sortSheet.classList.contains('is-open')
        ? closeSortSheet()
        : openSortSheet();
    });

    if (backdrop) {
      backdrop.addEventListener('click', closeSortSheet);
    }
  }

  /* ══════════════════════════════════════════════════════════
     Back/forward support
  ══════════════════════════════════════════════════════════ */
  window.addEventListener('popstate', function (e) {
    var url = new URL(window.location.href);
    var type = (e.state && e.state.type) || url.searchParams.get('type') || 'product';
    fetchAndSwap(buildUrl(type, url.searchParams.get('sort_by')), false);
  });

})();