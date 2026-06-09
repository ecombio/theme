/**
 * ECOMBIO Predictive Search
 * File: assets/ecombio-search.js
 *
 * Architecture: Class per search instance — supports desktop + mobile simultaneously
 * API: Shopify Ajax Predictive Search (/search/suggest.json)
 * Dependencies: None (vanilla JS, native Fetch, AbortController)
 *
 * Usage: Auto-initializes on DOMContentLoaded for all [data-search-instance] elements.
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

// Defaults — every value can be overridden by window.ECOMBIO_SEARCH_SETTINGS,
// which is injected by snippets/ecombio-search-form.liquid from Shopify Theme Settings.
const ECOMBIO_SEARCH_CONFIG = Object.assign(
  {
    MIN_QUERY_LENGTH:     2,
    DEBOUNCE_MS:          200,
    MAX_QUERIES:          3,
    MAX_PRODUCTS:         5,
    MAX_COLLECTIONS:      2,
    RECENT_SEARCHES_KEY:  'ecombio_recent_searches',
    RECENT_SEARCHES_LIMIT: 5,
    TRENDING_SEARCHES:    ['sofa', 'dining table', 'accent chair', 'floor lamp', 'bookshelf'],
    API_ENDPOINT:         '/search/suggest.json',
    CACHE_TTL_MS:         90000, // 90 seconds
  },
  // Theme-settings values injected by the Liquid snippet win over the defaults above.
  // The snippet only sets behaviour keys; RECENT_SEARCHES_KEY, API_ENDPOINT, and
  // CACHE_TTL_MS are intentionally not exposed in the theme editor.
  window.ECOMBIO_SEARCH_SETTINGS || {}
);

// ─── In-memory request cache ──────────────────────────────────────────────────

const searchCache = new Map();

function getCached(key) {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ECOMBIO_SEARCH_CONFIG.CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  searchCache.set(key, { data, ts: Date.now() });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(cents, currency = 'USD') {
  const amount = parseFloat(cents);
  if (isNaN(amount)) return '';
  // Shopify returns price as string like "199.00"
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function highlightMatch(text, query) {
  if (!query || !text) return escapeHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return escapeHtml(text).replace(regex, '<mark class="ecombio-search__highlight">$1</mark>');
}

function dispatchSearchEvent(name, detail) {
  document.dispatchEvent(new CustomEvent(`ecombio:${name}`, { detail, bubbles: true }));
}

// ─── Session storage helpers ──────────────────────────────────────────────────

function getRecentSearches() {
  try {
    return JSON.parse(sessionStorage.getItem(ECOMBIO_SEARCH_CONFIG.RECENT_SEARCHES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(query) {
  if (!query || query.trim().length < 2) return;
  const clean = query.trim();
  let recent = getRecentSearches().filter(s => s.toLowerCase() !== clean.toLowerCase());
  recent.unshift(clean);
  recent = recent.slice(0, ECOMBIO_SEARCH_CONFIG.RECENT_SEARCHES_LIMIT);
  try {
    sessionStorage.setItem(ECOMBIO_SEARCH_CONFIG.RECENT_SEARCHES_KEY, JSON.stringify(recent));
  } catch { /* storage full — ignore */ }
}

function removeRecentSearch(query) {
  const recent = getRecentSearches().filter(s => s !== query);
  try {
    sessionStorage.setItem(ECOMBIO_SEARCH_CONFIG.RECENT_SEARCHES_KEY, JSON.stringify(recent));
  } catch { /* ignore */ }
}

function clearAllRecentSearches() {
  try {
    sessionStorage.removeItem(ECOMBIO_SEARCH_CONFIG.RECENT_SEARCHES_KEY);
  } catch { /* ignore */ }
}

// ─── Main Class ───────────────────────────────────────────────────────────────

class EcombioPredictiveSearch {
  /**
   * @param {HTMLElement} rootEl — the .ecombio-search wrapper element
   */
  constructor(rootEl) {
    this.root        = rootEl;
    this.sfx         = rootEl.dataset.searchInstance || 'desktop';
    this.input       = rootEl.querySelector('.ecombio-search__input');
    this.form        = rootEl.querySelector('.ecombio-search__form');
    this.dropdown    = rootEl.querySelector('.ecombio-search__dropdown');
    this.clearBtn    = rootEl.querySelector('.ecombio-search__clear');
    this.backdrop    = rootEl.querySelector('.ecombio-search__backdrop');
    this.catBtn      = rootEl.querySelector('.ecombio-search__cat-btn');
    this.catList     = rootEl.querySelector('.ecombio-search__cat-list');
    this.catLabel    = rootEl.querySelector(`#ecombio-cat-label-${this.sfx}`);
    this.catHidden   = rootEl.querySelector(`#ecombio-cat-value-${this.sfx}`);

    this.activeCategory      = { value: '', label: 'All' };
    this.activeIndex         = -1;
    this.isOpen              = false;
    this.lastQuery           = '';
    this.abortController     = null;
    this.debouncedFetch      = debounce(this._executeFetch.bind(this), ECOMBIO_SEARCH_CONFIG.DEBOUNCE_MS);

    if (!this.input || !this.dropdown) {
      console.warn('[EcombioPredictiveSearch] Missing required elements in instance:', this.sfx);
      return;
    }

    this._bindEvents();
  }

  // ── Event Binding ──────────────────────────────────────────────────────────

  _bindEvents() {
    // Input events
    this.input.addEventListener('input', this._onInput.bind(this));
    this.input.addEventListener('focus', this._onFocus.bind(this));
    this.input.addEventListener('keydown', this._onKeydown.bind(this));

    // Clear button
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', this._onClear.bind(this));
    }

    // Form submit — save to recent
    this.form.addEventListener('submit', this._onFormSubmit.bind(this));

    // Category pill
    if (this.catBtn && this.catList) {
      this.catBtn.addEventListener('click', this._toggleCatList.bind(this));
      this.catList.addEventListener('click', this._onCatSelect.bind(this));
      this.catList.addEventListener('keydown', this._onCatKeydown.bind(this));
    }

    // Outside click — close dropdown
    document.addEventListener('click', this._onDocumentClick.bind(this));

    // Backdrop tap (mobile)
    if (this.backdrop) {
      this.backdrop.addEventListener('click', () => this.closeDropdown());
    }

    // Dropdown click delegation
    this.dropdown.addEventListener('click', this._onDropdownClick.bind(this));
  }

  // ── Input Handlers ─────────────────────────────────────────────────────────

  _onInput(e) {
    const query = e.target.value.trim();

    // Toggle clear button visibility
    if (this.clearBtn) {
      this.clearBtn.hidden = query.length === 0;
    }

    if (query.length < ECOMBIO_SEARCH_CONFIG.MIN_QUERY_LENGTH) {
      if (query.length === 0) {
        this._showEmptyFocus();
      } else {
        this.closeDropdown();
      }
      return;
    }

    this._showLoading();
    this.debouncedFetch(query);
  }

  _onFocus() {
    const query = this.input.value.trim();
    if (query.length >= ECOMBIO_SEARCH_CONFIG.MIN_QUERY_LENGTH) {
      // Re-show last results if same query
      if (query === this.lastQuery && this.isOpen) return;
      this._showLoading();
      this.debouncedFetch(query);
    } else {
      this._showEmptyFocus();
    }
  }

  _onClear() {
    this.input.value = '';
    this.input.focus();
    if (this.clearBtn) this.clearBtn.hidden = true;
    this._showEmptyFocus();
    dispatchSearchEvent('search_cleared', { instance: this.sfx });
  }

  _onFormSubmit(e) {
    const query = this.input.value.trim();
    if (query.length > 0) {
      saveRecentSearch(query);
      dispatchSearchEvent('search_started', {
        query,
        category: this.activeCategory.value,
        instance: this.sfx,
      });
    }
    this.closeDropdown();
  }

  // ── Fetch & Render ─────────────────────────────────────────────────────────

  async _executeFetch(query) {
    const cacheKey = `${query}|${this.activeCategory.value}`;
    const cached = getCached(cacheKey);

    if (cached) {
      this._renderResults(cached, query);
      return;
    }

    // Abort previous in-flight request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    const params = new URLSearchParams({
      q: query,
      'resources[type]': 'product,collection,query',
      'resources[limit]': '6',
      'resources[options][unavailable_products]': 'hide',
      'resources[options][fields]': 'title,product_type,variants.title,vendor,tag',
    });

    // Category scoping via tag filter
    if (this.activeCategory.value) {
      params.set('q', `${query} tag:${this.activeCategory.value}`);
    }

    try {
      const root = window.Shopify?.routes?.root || '/';
      const url = `${root}search/suggest.json?${params.toString()}`;

      const res = await fetch(url, {
        signal: this.abortController.signal,
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setCache(cacheKey, data);
      this._renderResults(data, query);

      dispatchSearchEvent('search_results_loaded', {
        query,
        category: this.activeCategory.value,
        productCount: data?.resources?.results?.products?.length || 0,
        collectionCount: data?.resources?.results?.collections?.length || 0,
        suggestionCount: data?.resources?.results?.queries?.length || 0,
        instance: this.sfx,
      });

    } catch (err) {
      if (err.name === 'AbortError') return; // Expected — new request cancelled this one
      console.error('[EcombioPredictiveSearch] Fetch error:', err);
      this._renderNetworkError();
    }
  }

  _renderResults(data, query) {
    const results = data?.resources?.results || {};
    const queries     = (results.queries     || []).slice(0, ECOMBIO_SEARCH_CONFIG.MAX_QUERIES);
    const products    = (results.products    || []).slice(0, ECOMBIO_SEARCH_CONFIG.MAX_PRODUCTS);
    const collections = (results.collections || []).slice(0, ECOMBIO_SEARCH_CONFIG.MAX_COLLECTIONS);

    const hasResults = queries.length > 0 || products.length > 0 || collections.length > 0;

    if (!hasResults) {
      this._renderEmpty(query);
      dispatchSearchEvent('search_zero_results', {
        query,
        category: this.activeCategory.value,
        instance: this.sfx,
      });
      return;
    }

    let html = `<div class="ecombio-search__results-header" aria-live="polite">
      <span class="ecombio-search__sr-announce" role="status">
        ${products.length + queries.length + collections.length} results available
      </span>
    </div>`;

    // ── Query suggestions ──
    if (queries.length > 0) {
      html += `<div class="ecombio-search__section ecombio-search__section--queries">`;
      queries.forEach((item, i) => {
        const label = escapeHtml(item.styled_text || item.text);
        html += `
          <a href="/search?q=${encodeURIComponent(item.text)}&type=product"
             class="ecombio-search__item ecombio-search__item--query"
             role="option"
             data-type="query"
             data-query="${escapeHtml(item.text)}"
             data-position="${i}">
            <span class="ecombio-search__item-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <span class="ecombio-search__item-text">${label}</span>
            <span class="ecombio-search__item-arrow" aria-hidden="true">↗</span>
          </a>`;
      });
      html += `</div>`;
    }

    // ── Products ──
    if (products.length > 0) {
      const sectionLabel = this.activeCategory.value
        ? `Products in ${this.activeCategory.label}`
        : 'Products';

      html += `<div class="ecombio-search__section ecombio-search__section--products">
        <p class="ecombio-search__section-label">${escapeHtml(sectionLabel)}</p>`;

      products.forEach((product, i) => {
        const price = product.price
          ? formatMoney(product.price)
          : (product.variants?.[0]?.price ? formatMoney(product.variants[0].price) : '');

        const imgSrc = product.featured_image?.url
          ? product.featured_image.url.replace(/(\.\w+)(\?|$)/, '_80x80$1$2')
          : null;

        const imgHtml = imgSrc
          ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.title)}" width="48" height="48" loading="lazy" class="ecombio-search__product-img">`
          : `<span class="ecombio-search__product-img ecombio-search__product-img--placeholder" aria-hidden="true">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                 <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l4-4 4 4 4-4 4 4"/>
               </svg>
             </span>`;

        const availBadge = product.available === false
          ? `<span class="ecombio-search__product-badge ecombio-search__product-badge--oos">Out of stock</span>`
          : '';

        html += `
          <a href="/products/${escapeHtml(product.handle)}"
             class="ecombio-search__item ecombio-search__item--product"
             role="option"
             data-type="product"
             data-id="${escapeHtml(product.id)}"
             data-position="${i}">
            <span class="ecombio-search__product-media">${imgHtml}</span>
            <span class="ecombio-search__product-info">
              <span class="ecombio-search__product-title">${highlightMatch(product.title, query)}</span>
              <span class="ecombio-search__product-meta">
                ${price ? `<span class="ecombio-search__product-price">${escapeHtml(price)}</span>` : ''}
                ${availBadge}
              </span>
            </span>
          </a>`;
      });

      html += `</div>`;
    }

    // ── Collections ── (hidden when category filter is active)
    if (collections.length > 0 && !this.activeCategory.value) {
      html += `<div class="ecombio-search__section ecombio-search__section--collections">
        <p class="ecombio-search__section-label">Collections</p>`;

      collections.forEach((col, i) => {
        html += `
          <a href="/collections/${escapeHtml(col.handle)}"
             class="ecombio-search__item ecombio-search__item--collection"
             role="option"
             data-type="collection"
             data-id="${escapeHtml(col.id)}"
             data-position="${i}">
            <span class="ecombio-search__item-icon ecombio-search__item-icon--folder" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </span>
            <span class="ecombio-search__item-text">${highlightMatch(col.title, query)}</span>
            <span class="ecombio-search__item-count" aria-label="${col.products_count || ''} products">
              ${col.products_count ? `${col.products_count} items` : ''}
            </span>
          </a>`;
      });

      html += `</div>`;
    }

    // ── View all ──
    const viewAllHref = `/search?q=${encodeURIComponent(query)}&type=product${this.activeCategory.value ? `&tag=${encodeURIComponent(this.activeCategory.value)}` : ''}`;
    html += `
      <div class="ecombio-search__section ecombio-search__section--footer">
        <a href="${viewAllHref}"
           class="ecombio-search__view-all"
           role="option"
           data-type="view_all">
          View all results for <strong>"${escapeHtml(query)}"</strong>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </a>
      </div>`;

    this.dropdown.innerHTML = html;
    this.openDropdown();
    this.activeIndex = -1;
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────

  _showLoading() {
    const skeletonRow = () => `
      <div class="ecombio-search__skeleton-row" aria-hidden="true">
        <div class="ecombio-search__skeleton ecombio-search__skeleton--icon"></div>
        <div class="ecombio-search__skeleton-content">
          <div class="ecombio-search__skeleton ecombio-search__skeleton--title"></div>
          <div class="ecombio-search__skeleton ecombio-search__skeleton--subtitle"></div>
        </div>
      </div>`;

    this.dropdown.innerHTML = `
      <div class="ecombio-search__loading" aria-label="Loading results" role="status">
        ${skeletonRow()}${skeletonRow()}${skeletonRow()}
      </div>`;

    this.openDropdown();
  }

  // ── Empty focus (recent + trending) ───────────────────────────────────────

  _showEmptyFocus() {
    const recent = getRecentSearches();
    const trending = ECOMBIO_SEARCH_CONFIG.TRENDING_SEARCHES;
    let html = '';

    if (recent.length > 0) {
      html += `
        <div class="ecombio-search__section ecombio-search__section--recent">
          <div class="ecombio-search__section-header">
            <p class="ecombio-search__section-label">Recent</p>
            <button type="button" class="ecombio-search__clear-recent" data-action="clear-all">
              Clear all
            </button>
          </div>`;

      recent.forEach((term, i) => {
        html += `
          <div class="ecombio-search__item ecombio-search__item--recent"
               role="option" data-type="recent" data-query="${escapeHtml(term)}" data-position="${i}">
            <span class="ecombio-search__item-icon" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
              </svg>
            </span>
            <span class="ecombio-search__item-text">${escapeHtml(term)}</span>
            <button type="button" class="ecombio-search__remove-recent"
                    data-action="remove-recent" data-term="${escapeHtml(term)}"
                    aria-label="Remove ${escapeHtml(term)} from recent searches">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>`;
      });

      html += `</div>`;
    }

    if (trending.length > 0) {
      html += `
        <div class="ecombio-search__section ecombio-search__section--trending">
          <p class="ecombio-search__section-label">Trending</p>
          <div class="ecombio-search__trending-pills">`;

      trending.forEach(term => {
        html += `
          <button type="button" class="ecombio-search__trending-pill"
                  data-action="trending" data-query="${escapeHtml(term)}">
            ${escapeHtml(term)}
          </button>`;
      });

      html += `</div></div>`;
    }

    if (html) {
      this.dropdown.innerHTML = html;
      this.openDropdown();
    } else {
      this.closeDropdown();
    }
  }

  // ── Empty / error states ───────────────────────────────────────────────────

  _renderEmpty(query) {
    const suggestions = ECOMBIO_SEARCH_CONFIG.TRENDING_SEARCHES.slice(0, 3);
    this.dropdown.innerHTML = `
      <div class="ecombio-search__empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
        <p class="ecombio-search__empty-title">No results for <em>"${escapeHtml(query)}"</em></p>
        <p class="ecombio-search__empty-hint">Try:</p>
        <div class="ecombio-search__trending-pills">
          ${suggestions.map(s => `
            <button type="button" class="ecombio-search__trending-pill"
                    data-action="trending" data-query="${escapeHtml(s)}">
              ${escapeHtml(s)}
            </button>`).join('')}
        </div>
      </div>`;
    this.openDropdown();
  }

  _renderNetworkError() {
    this.dropdown.innerHTML = `
      <div class="ecombio-search__empty ecombio-search__empty--error">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p class="ecombio-search__empty-title">Search unavailable</p>
        <p class="ecombio-search__empty-hint">Please try again in a moment.</p>
      </div>`;
    this.openDropdown();
  }

  // ── Dropdown open/close ────────────────────────────────────────────────────

  openDropdown() {
    this.dropdown.hidden = false;
    this.isOpen = true;
    this.input.setAttribute('aria-expanded', 'true');
    this.root.classList.add('ecombio-search--open');

    // Mobile bottom sheet
    if (this.backdrop && window.innerWidth < 768) {
      this.backdrop.hidden = false;
      document.body.classList.add('ecombio-search-lock');
    }
  }

  closeDropdown() {
    this.dropdown.hidden = true;
    this.isOpen = false;
    this.activeIndex = -1;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.root.classList.remove('ecombio-search--open');

    if (this.backdrop) {
      this.backdrop.hidden = true;
    }
    document.body.classList.remove('ecombio-search-lock');
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────

  _onKeydown(e) {
    if (!this.isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._onFocus();
      }
      return;
    }

    const items = Array.from(
      this.dropdown.querySelectorAll('.ecombio-search__item, .ecombio-search__view-all')
    );

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
        this._updateActiveItem(items);
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (this.activeIndex <= 0) {
          this.activeIndex = -1;
          this.input.removeAttribute('aria-activedescendant');
          items.forEach(el => el.classList.remove('ecombio-search__item--active'));
        } else {
          this.activeIndex = this.activeIndex - 1;
          this._updateActiveItem(items);
        }
        break;

      case 'Enter':
        if (this.activeIndex >= 0 && items[this.activeIndex]) {
          e.preventDefault();
          items[this.activeIndex].click();
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.closeDropdown();
        this.input.blur();
        break;

      case 'Tab':
        this.closeDropdown();
        break;
    }
  }

  _updateActiveItem(items) {
    items.forEach((el, i) => {
      const isActive = i === this.activeIndex;
      el.classList.toggle('ecombio-search__item--active', isActive);
      el.id = el.id || `ecombio-option-${this.sfx}-${i}`;
      if (isActive) {
        this.input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  // ── Dropdown click delegation ──────────────────────────────────────────────

  _onDropdownClick(e) {
    // Recent search row click → populate input
    const recentItem = e.target.closest('[data-type="recent"]');
    if (recentItem) {
      const removeBtn = e.target.closest('[data-action="remove-recent"]');
      if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        removeRecentSearch(removeBtn.dataset.term);
        this._showEmptyFocus();
        return;
      }
      const term = recentItem.dataset.query;
      if (term) {
        this.input.value = term;
        this._showLoading();
        this._executeFetch(term);
      }
      return;
    }

    // Clear all recent
    const clearAll = e.target.closest('[data-action="clear-all"]');
    if (clearAll) {
      clearAllRecentSearches();
      this._showEmptyFocus();
      return;
    }

    // Trending pill
    const trendingBtn = e.target.closest('[data-action="trending"]');
    if (trendingBtn) {
      const term = trendingBtn.dataset.query;
      this.input.value = term;
      if (this.clearBtn) this.clearBtn.hidden = false;
      this._showLoading();
      this._executeFetch(term);
      return;
    }

    // Query suggestion → populate input, re-search
    const queryItem = e.target.closest('[data-type="query"]');
    if (queryItem) {
      const q = queryItem.dataset.query;
      if (q) {
        this.input.value = q;
        saveRecentSearch(q);
      }
      dispatchSearchEvent('search_result_clicked', {
        query: this.input.value,
        resultType: 'query',
        position: parseInt(queryItem.dataset.position || '0', 10),
        instance: this.sfx,
      });
    }

    // Product / collection clicks
    const productItem = e.target.closest('[data-type="product"]');
    if (productItem) {
      dispatchSearchEvent('search_result_clicked', {
        query: this.input.value,
        resultType: 'product',
        productId: productItem.dataset.id,
        position: parseInt(productItem.dataset.position || '0', 10),
        instance: this.sfx,
      });
      saveRecentSearch(this.input.value);
    }

    const colItem = e.target.closest('[data-type="collection"]');
    if (colItem) {
      dispatchSearchEvent('search_result_clicked', {
        query: this.input.value,
        resultType: 'collection',
        collectionId: colItem.dataset.id,
        position: parseInt(colItem.dataset.position || '0', 10),
        instance: this.sfx,
      });
      saveRecentSearch(this.input.value);
    }
  }

  // ── Category pill ──────────────────────────────────────────────────────────

  _toggleCatList(e) {
    const expanded = this.catBtn.getAttribute('aria-expanded') === 'true';
    this.catBtn.setAttribute('aria-expanded', String(!expanded));
    this.catList.hidden = expanded;
  }

  _onCatSelect(e) {
    const option = e.target.closest('[role="option"]');
    if (!option) return;

    // Update selected state
    this.catList.querySelectorAll('[role="option"]').forEach(el => {
      el.setAttribute('aria-selected', 'false');
    });
    option.setAttribute('aria-selected', 'true');

    this.activeCategory = {
      value: option.dataset.value || '',
      label: option.dataset.label || 'All',
    };

    if (this.catLabel) this.catLabel.textContent = this.activeCategory.label;
    if (this.catHidden) this.catHidden.value = this.activeCategory.value;

    // Close pill list
    this.catBtn.setAttribute('aria-expanded', 'false');
    this.catList.hidden = true;

    // Re-fire search if query is active
    const query = this.input.value.trim();
    if (query.length >= ECOMBIO_SEARCH_CONFIG.MIN_QUERY_LENGTH) {
      this._showLoading();
      this._executeFetch(query);
    }
  }

  _onCatKeydown(e) {
    if (e.key === 'Escape') {
      this.catBtn.setAttribute('aria-expanded', 'false');
      this.catList.hidden = true;
      this.catBtn.focus();
    }
  }

  // ── Outside click ──────────────────────────────────────────────────────────

  _onDocumentClick(e) {
    if (!this.root.contains(e.target)) {
      this.closeDropdown();
      // Also close category list
      if (this.catBtn && this.catList) {
        this.catBtn.setAttribute('aria-expanded', 'false');
        this.catList.hidden = true;
      }
    }
  }
}

// ─── Auto-init ────────────────────────────────────────────────────────────────

function initEcombioPredictiveSearch() {
  const instances = document.querySelectorAll('[data-search-instance]');
  instances.forEach(el => {
    if (!el._ecombioSearch) {
      el._ecombioSearch = new EcombioPredictiveSearch(el);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEcombioPredictiveSearch);
} else {
  initEcombioPredictiveSearch();
}

// Re-init after Shopify section renders (theme editor live preview)
document.addEventListener('shopify:section:load', initEcombioPredictiveSearch);

// ─── Analytics bridge (hook into your analytics stack) ───────────────────────
// Listen for events dispatched by EcombioPredictiveSearch and forward to GA4 / Klaviyo etc.
//
// Example:
// document.addEventListener('ecombio:search_result_clicked', (e) => {
//   gtag('event', 'select_content', { content_type: e.detail.resultType, item_id: e.detail.productId });
// });
