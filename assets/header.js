/**
 * header.js
 *
 * Responsibilities:
 *   1. Mobile menu toggle (hamburger ↔ nav open/close)
 *   2. Sticky header on scroll
 *   3. Cart count badge updates (listens for cart:updated dispatched by
 *      cart-drawer.js and product-card.js — do not duplicate that logic here)
 *   4. Predictive search: toggle the flyout panel, debounce input, fetch
 *      Shopify's /search/suggest.json endpoint, render grouped results.
 *
 * Loaded via theme.liquid with `defer`. Runs after DOM is ready.
 * No dependencies on other scripts; safe to load in any order alongside
 * product-card.js and cart-drawer.js.
 */

(function () {
  'use strict';

  // ── Selectors ────────────────────────────────────────────────────────────

  const header     = document.querySelector('[data-header]');
  const menuToggle = header?.querySelector('[data-menu-toggle]');
  const nav        = header?.querySelector('[data-nav]');
  const cartCount  = header?.querySelectorAll('[data-cart-count]');

  const searchToggle  = header?.querySelector('[data-search-toggle]');
  const searchPanel   = header?.querySelector('[data-search-panel]');
  const searchForm    = header?.querySelector('[data-search-form]');
  const searchInput   = header?.querySelector('[data-search-input]');
  const searchClear   = header?.querySelector('[data-search-clear]');
  const searchClose   = header?.querySelector('[data-search-close]');
  const searchResults = header?.querySelector('[data-search-results]');
  const searchHint    = header?.querySelector('[data-search-hint]');
  const searchStatus  = header?.querySelector('[data-search-status]');
  const searchBackdrop = document.querySelector('[data-search-backdrop]');

  if (!header) return;

  // ── 1. Mobile menu toggle ─────────────────────────────────────────────────

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';

      menuToggle.setAttribute('aria-expanded', String(!isOpen));
      nav.classList.toggle('is-open', !isOpen);
    });

    // Close nav on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.focus();
      }
    });

    // Close nav when a link inside it is followed
    nav.querySelectorAll('.header__nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ── 2. Sticky header ──────────────────────────────────────────────────────

  const STICKY_CLASS = 'header--sticky';

  // IntersectionObserver approach: avoids scroll-event overhead.
  // We observe a zero-height sentinel placed just above the header.
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;pointer-events:none;';
  document.body.insertBefore(sentinel, document.body.firstChild);

  const stickyObserver = new IntersectionObserver(
    ([entry]) => {
      header.classList.toggle(STICKY_CLASS, !entry.isIntersecting);
    },
    { threshold: 0 }
  );

  stickyObserver.observe(sentinel);

  // ── 3. Cart count badge ───────────────────────────────────────────────────

  /**
   * Updates every [data-cart-count] badge in the header.
   * Called on cart:updated events dispatched by cart-drawer.js /
   * product-card.js with detail: { itemCount: Number }
   */
  function updateCartCount(count) {
    cartCount?.forEach((badge) => {
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('header__cart-count--hidden');
      } else {
        badge.textContent = '';
        badge.classList.add('header__cart-count--hidden');
      }
    });

    // Keep the aria-label on the cart anchor in sync
    const cartAnchor = header.querySelector('[data-cart-icon-btn]');
    if (cartAnchor) {
      cartAnchor.setAttribute('aria-label', `Cart (${count})`);
    }
  }

  document.addEventListener('cart:updated', (e) => {
    const count = e.detail?.itemCount ?? 0;
    updateCartCount(count);
  });

  // ── 4. Predictive search ──────────────────────────────────────────────────

  if (searchToggle && searchPanel && searchInput) {
    const DEBOUNCE_MS = 250;
    const MIN_QUERY_LENGTH = 2;
    const RESOURCE_LIMIT = 4; // per-type limit requested from the API

    let debounceTimer = null;
    let activeController = null; // AbortController for the in-flight fetch
    let lastQuery = '';

    // -- Open / close --------------------------------------------------------

    function openSearch() {
      searchPanel.hidden = false;
      searchBackdrop && (searchBackdrop.hidden = false);
      searchToggle.setAttribute('aria-expanded', 'true');
      // Defer focus so iOS doesn't fight the panel's own layout shift.
      window.requestAnimationFrame(() => searchInput.focus());
      document.addEventListener('keydown', onKeydown);
      document.addEventListener('click', onOutsideClick, true);
    }

    function closeSearch({ restoreFocus = true } = {}) {
      searchPanel.hidden = true;
      searchBackdrop && (searchBackdrop.hidden = true);
      searchToggle.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('click', onOutsideClick, true);
      if (restoreFocus) searchToggle.focus();
    }

    function isOpen() {
      return searchPanel.hidden === false;
    }

    function onKeydown(e) {
      if (e.key === 'Escape') closeSearch();
    }

    function onOutsideClick(e) {
      if (!searchPanel.contains(e.target) && e.target !== searchToggle) {
        closeSearch({ restoreFocus: false });
      }
    }

    searchToggle.addEventListener('click', () => {
      isOpen() ? closeSearch() : openSearch();
    });

    searchClose?.addEventListener('click', () => closeSearch());
    searchBackdrop?.addEventListener('click', () => closeSearch({ restoreFocus: false }));

    // -- Clear button ---------------------------------------------------------

    function setClearVisible(visible) {
      if (!searchClear) return;
      searchClear.hidden = !visible;
    }

    searchClear?.addEventListener('click', () => {
      searchInput.value = '';
      setClearVisible(false);
      showHint();
      searchInput.focus();
    });

    // -- Rendering helpers ------------------------------------------------------

    // All values from the API are user/catalog content, never trusted as
    // markup. textContent + DOM construction throughout — no innerHTML with
    // interpolated strings.

    function clearResults() {
      searchResults.innerHTML = '';
    }

    function showHint() {
      clearResults();
      searchHint.hidden = false;
      searchResults.appendChild(searchHint);
      setStatus('');
    }

    function showLoading() {
      clearResults();
      const loading = document.createElement('p');
      loading.className = 'header__search-hint';
      loading.textContent = 'Searching…';
      searchResults.appendChild(loading);
    }

    function showEmpty(query) {
      clearResults();
      const empty = document.createElement('p');
      empty.className = 'header__search-empty';
      empty.textContent = `No results for "${query}".`;
      searchResults.appendChild(empty);
      setStatus(`No results for ${query}.`);
    }

    function showError() {
      clearResults();
      const error = document.createElement('p');
      error.className = 'header__search-empty';
      error.textContent = 'Something went wrong. Press Enter to see all results.';
      searchResults.appendChild(error);
    }

    function setStatus(message) {
      if (searchStatus) searchStatus.textContent = message;
    }

    function formatMoney(cents) {
      if (typeof cents !== 'number') return '';
      // Falls back to a plain decimal if Shopify.formatMoney isn't present;
      // most themes load that helper globally via constants.js.
      if (window.Shopify?.formatMoney && window.themeMoneyFormat) {
        return window.Shopify.formatMoney(cents, window.themeMoneyFormat);
      }
      return `$${(cents / 100).toFixed(2)}`;
    }

    const GROUP_LABELS = {
      products: 'Products',
      collections: 'Collections',
      pages: 'Pages',
      articles: 'Articles',
      queries: 'Suggestions',
    };

    function buildResultLink(item, type) {
      const a = document.createElement('a');
      a.className = 'header__search-result';
      a.href = item.url;

      if (type === 'products') {
        const media = document.createElement('span');
        media.className = 'header__search-result-media';
        if (item.image) {
          const img = document.createElement('img');
          img.src = item.image;
          img.alt = '';
          img.loading = 'lazy';
          media.appendChild(img);
        }
        a.appendChild(media);
      }

      const body = document.createElement('span');
      body.className = 'header__search-result-body';

      const title = document.createElement('span');
      title.className = 'header__search-result-title';
      title.textContent = item.title;
      body.appendChild(title);

      if (type === 'products' && typeof item.price === 'number') {
        const price = document.createElement('span');
        price.className = 'header__search-result-price';
        price.textContent = formatMoney(item.price);
        body.appendChild(price);
      }

      a.appendChild(body);
      return a;
    }

    function renderResults(data, query) {
      const resources = data?.resources?.results || {};
      const types = ['products', 'collections', 'pages', 'articles'];
      const totalCount = types.reduce(
        (sum, type) => sum + (resources[type]?.length || 0),
        0
      );

      if (totalCount === 0) {
        showEmpty(query);
        return;
      }

      clearResults();

      types.forEach((type) => {
        const items = resources[type];
        if (!items || items.length === 0) return;

        const group = document.createElement('div');
        group.className = 'header__search-group';

        const heading = document.createElement('p');
        heading.className = 'header__search-group-title';
        heading.textContent = GROUP_LABELS[type] || type;
        group.appendChild(heading);

        items.forEach((item) => group.appendChild(buildResultLink(item, type)));
        searchResults.appendChild(group);
      });

      const viewAll = document.createElement('a');
      viewAll.className = 'header__search-view-all';
      viewAll.href = `${searchForm.action}?q=${encodeURIComponent(query)}&type=${encodeURIComponent(
        searchForm.querySelector('input[name="type"]').value
      )}`;
      viewAll.textContent = `View all results for "${query}"`;
      searchResults.appendChild(viewAll);

      setStatus(`${totalCount} result${totalCount === 1 ? '' : 's'} for ${query}.`);
    }

    // -- Fetch ------------------------------------------------------------------

    function fetchResults(query) {
      activeController?.abort();
      activeController = new AbortController();

      const url =
        `/search/suggest.json?q=${encodeURIComponent(query)}` +
        `&resources[type]=product,collection,page,article` +
        `&resources[limit]=${RESOURCE_LIMIT}` +
        `&resources[options][unavailable_products]=last`;

      showLoading();

      fetch(url, { signal: activeController.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`Search request failed: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          // Guard against the input changing again while this was in flight.
          if (searchInput.value.trim() !== query) return;
          renderResults(data, query);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          showError();
        });
    }

    // -- Input handling -----------------------------------------------------

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      setClearVisible(query.length > 0);

      window.clearTimeout(debounceTimer);

      if (query.length < MIN_QUERY_LENGTH) {
        activeController?.abort();
        showHint();
        lastQuery = '';
        return;
      }

      if (query === lastQuery) return;

      debounceTimer = window.setTimeout(() => {
        lastQuery = query;
        fetchResults(query);
      }, DEBOUNCE_MS);
    });

    // Enter still submits the form for a full search-results-page fallback;
    // no preventDefault here, so unJS'd/slow-network behavior degrades cleanly.
  }

})();
