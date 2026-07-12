/**
 * Header Search
 * File: assets/header-search.js
 * Loaded by: snippets/header-search.liquid  (only when predictive search is on)
 *
 * ── OVERVIEW ────────────────────────────────────────────────────────────
 * Coordinates the full search UX inside each [data-search-root] wrapper.
 * The Section Rendering API / predictive-search.liquid pipeline is
 * unchanged — this file only fetches, injects, and manages state.
 *
 * Responsibilities:
 *   1. Fetch & cache   — debounced, abort-controller, 60 s TTL
 *   2. Panel states    — loading · empty-state · results · error
 *   3. Open / close    — aria-expanded, outside-click dismiss
 *   4. Keyboard nav    — ArrowUp/Down across all panel items, Escape
 *   5. Clear button    — shown/hidden reactively, all entry paths covered
 *   6. Voice search    — Web Speech API, pulse animation, graceful no-op
 *   7. Typewriter      — animated placeholder cycling HS_TRENDING terms
 *                         over a decorative overlay, with each newly
 *                         typed character fading from an accent color to
 *                         the muted resting color (CSS can't do this on
 *                         a native placeholder attribute, which is why
 *                         it's a separate overlay element rather than
 *                         input.placeholder). Falls back to writing
 *                         plain text into input.placeholder if no
 *                         overlay element is found (e.g. older markup).
 *                         Pauses only while input HAS a value, NOT on
 *                         every focus, so it keeps running in empty state.
 *   8. Empty / focus state
 *        • Recent searches  (sessionStorage, max 5, remove + clear-all)
 *        • Trending searches (window.HS_TRENDING)
 *        shown on focus with empty input; replaced by predictive results
 *        once the query reaches MIN_QUERY_LENGTH characters
 *
 * ── ARCHITECTURE ────────────────────────────────────────────────────────
 * Each [data-search-root] element (desktop + mobile) gets its own
 * independent HeaderSearch instance. They share only the module-level
 * fetch cache and RecentSearches storage — both of which are intentional.
 *
 * ── CLEAR BUTTON CONTRACT ───────────────────────────────────────────────
 * A single _syncClear() helper owns clear-button visibility and is called
 * from every code path that can change input.value:
 *   - 'input' event (typing / pasting / browser autofill)
 *   - 'change' event (some autofill paths that skip 'input')
 *   - after voice transcript is written
 *   - after the clear button itself is clicked
 *   - on init (page load with pre-filled search.terms value)
 *
 * ── HAS-VALUE CLASS CONTRACT ────────────────────────────────────────────
 * A single _syncHasValue() helper owns the .header-search--has-value class
 * on the root element (used by CSS to hide the typewriter overlay whenever
 * the input holds real text). Called from the same set of entry points as
 * _syncClear() above, plus AnimatedPlaceholder's own pause/resume.
 *
 * ── KEYBOARD NAV ────────────────────────────────────────────────────────
 * The walker selector picks up focusable children of [role="option"] li
 * items. Both predictive results AND the empty-state markup use the same
 * [role="option"] li pattern, so the same walker works everywhere:
 *
 *   Recent row  → li[role="option"] contains: <a> + <button class="hs-empty__remove">
 *   Trending    → li[role="option"] contains: <a class="hs-empty__pill">
 *   Predictive  → li[role="option"] contains: <a>
 *   View-all    → <a role="option">  (direct, no li wrapper)
 *
 * ── RECENT SEARCHES ─────────────────────────────────────────────────────
 * Key   : HS_RECENT_<hostname>   (namespaced so staging ≠ production)
 * Store : sessionStorage         (cleared when the tab closes)
 * Cap   : MAX_RECENT = 5 terms
 * Save  : on form submit · on clicking a result link (predictive or empty)
 * API   : RecentSearches.add / .remove / .clear / .load
 *
 * ── TRENDING SEARCHES ───────────────────────────────────────────────────
 * Read from window.HS_TRENDING, injected by the Liquid snippet from the
 * 'predictive-search-trending' menu (or built-in defaults).
 */

'use strict';

(function () {

  /* ── Constants ──────────────────────────────────────────────────────── */
  var MIN_QUERY_LENGTH = 2;
  var DEBOUNCE_MS      = 300;
  var CACHE_TTL_MS     = 60000;  /* 60 s result cache */
  var MAX_RECENT       = 5;

  /* Shared fetch-result cache (query → { html, ts }) */
  var _cache = new Map();

  /* sessionStorage key namespaced to prevent cross-environment bleed */
  var STORAGE_KEY = 'HS_RECENT_' + window.location.hostname;


  /* ── Utilities ──────────────────────────────────────────────────────── */

  function debounce(fn, wait) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  /**
   * Minimal HTML escaper for user-controlled strings dropped into innerHTML.
   * Only the five characters that matter for injection are replaced.
   */
  function esc(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#x27;');
  }


  /* ── Recent Searches ────────────────────────────────────────────────── */

  var RecentSearches = {
    load: function () {
      try {
        var raw = sessionStorage.getItem(STORAGE_KEY);
        var arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (_) {
        return [];
      }
    },

    _save: function (list) {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (_) {}
    },

    /**
     * Prepend a new term, deduplicate case-insensitively, cap at MAX_RECENT.
     * No-op for blank strings.
     */
    add: function (term) {
      var t = (term || '').trim();
      if (!t) return;
      var list = this.load().filter(function (s) {
        return s.toLowerCase() !== t.toLowerCase();
      });
      list.unshift(t);
      this._save(list.slice(0, MAX_RECENT));
    },

    remove: function (term) {
      var t = (term || '').toLowerCase();
      this._save(this.load().filter(function (s) {
        return s.toLowerCase() !== t;
      }));
    },

    clear: function () { this._save([]); },
  };


  /* ── Empty-State HTML Builder ───────────────────────────────────────── */

  /**
   * Builds the panel HTML for the focus/empty state.
   *
   * Markup rules so keyboard nav works with zero changes to the walker:
   *   • Every interactive row/pill is wrapped in  li[role="option"]
   *   • Focusable children use  tabindex="-1"  (walker manages focus)
   *   • The ✕ button is a sibling inside the same <a>, not outside it,
   *     so clicking ✕ does NOT navigate to the link's href
   *
   * @param {string[]} trending   window.HS_TRENDING
   * @param {string[]} recent     RecentSearches.load()
   * @param {string}   searchUrl  routes.search_url from data-search-url
   * @returns {string}  HTML string, or '' if nothing to show
   */
  function buildEmptyState(trending, recent, searchUrl) {
    var html = '';

    /* ── Recent searches section ───────────────────────────────────── */
    if (recent.length) {
      html += '<div class="hs-empty__group">';

      /* Header row: label + clear-all */
      html += '<div class="hs-empty__group-header">'
            + '<p class="hs-empty__label" id="HsRecentLabel">Recent searches</p>'
            + '<button type="button" class="hs-empty__clear-all" '
            +         'data-hs-clear-recent '
            +         'aria-label="Clear all recent searches">'
            +   'Clear all'
            + '</button>'
            + '</div>';

      html += '<ul class="predictive-search__list" '
            +      'role="group" aria-labelledby="HsRecentLabel">';

      recent.forEach(function (term) {
        var e    = esc(term);
        var href = searchUrl + '?q=' + encodeURIComponent(term) + '&type=product';

        /*
         * The ✕ button lives INSIDE the <a> tag so it is part of the
         * same [role="option"] focusable child and the walker reaches it
         * with ArrowDown. We stop propagation on the button's click to
         * prevent the link from firing.
         */
        html += '<li role="option" class="predictive-search__list-item">'
              +   '<a href="' + href + '" '
              +      'class="predictive-search__item hs-empty__recent-item" '
              +      'tabindex="-1" '
              +      'data-hs-recent-term="' + e + '">'

              +     '<span class="predictive-search__item-icon" aria-hidden="true">'
              +       '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" '
              +            'stroke="currentColor" stroke-width="2" '
              +            'stroke-linecap="round" stroke-linejoin="round">'
              +         '<circle cx="12" cy="12" r="10"/>'
              +         '<polyline points="12 6 12 12 16 14"/>'
              +       '</svg>'
              +     '</span>'

              +     '<span class="hs-empty__recent-text">' + e + '</span>'

              +     '<button type="button" '
              +             'class="hs-empty__remove" '
              +             'tabindex="-1" '
              +             'data-hs-remove-recent="' + e + '" '
              +             'aria-label="Remove \u201c' + e + '\u201d from recent searches">'
              +       '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" '
              +            'stroke="currentColor" stroke-width="2.5" '
              +            'stroke-linecap="round" aria-hidden="true">'
              +         '<line x1="18" y1="6" x2="6" y2="18"/>'
              +         '<line x1="6" y1="6" x2="18" y2="18"/>'
              +       '</svg>'
              +     '</button>'

              +   '</a>'
              + '</li>';
      });

      html += '</ul></div>';
    }

    /* ── Trending searches section ─────────────────────────────────── */
    if (trending && trending.length) {
      html += '<div class="hs-empty__group">'
            + '<p class="hs-empty__label" id="HsTrendingLabel">Trending searches</p>'
            + '<ul class="hs-empty__pill-list" '
            +      'role="group" aria-labelledby="HsTrendingLabel">';

      trending.forEach(function (term) {
        var e    = esc(term);
        var href = searchUrl + '?q=' + encodeURIComponent(term) + '&type=product';

        html += '<li role="option" class="hs-empty__pill-item">'
              +   '<a href="' + href + '" '
              +      'class="hs-empty__pill" '
              +      'tabindex="-1" '
              +      'data-hs-trending-term="' + e + '">'
              +     e
              +   '</a>'
              + '</li>';
      });

      html += '</ul></div>';
    }

    return html;
  }


  /* ── Animated Placeholder (Typewriter) ─────────────────────────────── */

  /**
   * Cycles through terms with a typewriter effect. If an overlay element
   * is provided, characters are rendered as individual spans that fade
   * from --hs-accent-fade to --hs-text-muted (the Back Market-style
   * color-wash effect) — CSS can't do this on a native placeholder
   * attribute. Without an overlay it falls back to writing plain text
   * into input.placeholder, so this constructor is safe to call even if
   * the markup hasn't been updated with the overlay span yet.
   *
   * KEY BEHAVIOUR (unchanged from original):
   *   Pauses when input.value is non-empty, NOT on every focus event.
   *   This keeps the animation running while the empty-state panel is open.
   *
   * @param {HTMLInputElement} input
   * @param {string[]} terms
   * @param {HTMLElement|null} overlay  [data-search-typewriter] element, if present
   * @param {Function|null} onVisibilityChange  called with true/false when
   *   the overlay's visibility changes, so the caller can sync any other
   *   UI state (e.g. the --has-value class on the root)
   */
  function AnimatedPlaceholder(input, terms, overlay, onVisibilityChange) {
    if (!terms || !terms.length) return;

    this.input       = input;
    this.overlay     = overlay || null;
    this.onVisChange = typeof onVisibilityChange === 'function' ? onVisibilityChange : null;
    this.terms        = terms;
    this.termIndex    = 0;
    this.charIndex    = 0;
    this.deleting     = false;
    this.paused       = false;
    this.rafId        = null;
    this.lastTick     = 0;
    this.pauseUntil   = 0;
    this.staticText   = input.placeholder || 'What are you looking for?';

    var self = this;

    if (this.overlay) {
      this.overlay.innerHTML =
        '<span class="hs-tw-prefix">Try \u201c</span>'
        + '<span class="hs-tw-chars"></span>'
        + '<span class="hs-tw-suffix">\u201d</span>';
      this.charsEl = this.overlay.querySelector('.hs-tw-chars');
      /* Overlay owns the visible text now — clear the native attribute
         so nothing doubles up underneath it. */
      input.placeholder = '';
    }

    /* Pause/resume based on value, not focus */
    input.addEventListener('input', function () {
      if (input.value) {
        if (!self.paused) self._pause();
      } else {
        if (self.paused) self.resume();
      }
    });

    /* Resume if user clears via keyboard on blur */
    input.addEventListener('blur', function () {
      if (!input.value && self.paused) self.resume();
    });

    this._syncOverlayVisibility();
    this._tick(performance.now());
  }

  AnimatedPlaceholder.prototype._syncOverlayVisibility = function () {
    var hasValue = !!this.input.value;
    if (this.overlay) this.overlay.style.display = hasValue ? 'none' : '';
    if (this.onVisChange) this.onVisChange(hasValue);
  };

  AnimatedPlaceholder.prototype._pause = function () {
    this.paused = true;
    this._syncOverlayVisibility();
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  };

  /**
   * Appends one character span. It's given the accent color with
   * transitions disabled for one paint, then the class is removed so
   * `transition: color` on .hs-tw-char eases it back to the muted
   * resting color. Two nested rAFs are needed — one alone can land in
   * the same paint as the initial style and skip the transition.
   */
  AnimatedPlaceholder.prototype._appendChar = function (ch) {
    if (!this.charsEl) return;
    var span = document.createElement('span');
    span.className = 'hs-tw-char hs-tw-char--fresh';
    span.textContent = ch;
    this.charsEl.appendChild(span);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        span.classList.remove('hs-tw-char--fresh');
      });
    });
  };

  AnimatedPlaceholder.prototype._removeChar = function () {
    if (this.charsEl && this.charsEl.lastElementChild) {
      this.charsEl.removeChild(this.charsEl.lastElementChild);
    }
  };

  AnimatedPlaceholder.prototype._tick = function (now) {
    var self     = this;
    var TYPING   = 68;   /* ms per character typed */
    var DELETING = 36;   /* ms per character deleted */
    var HOLD     = 3200; /* ms to hold the completed term */
    var GAP      = 400;  /* ms pause before next term */

    if (this.paused || this.input.value) return;

    if (now < this.pauseUntil) {
      this.rafId = requestAnimationFrame(function (t) { self._tick(t); });
      return;
    }

    var term = this.terms[this.termIndex];

    if (!this.deleting) {
      if (now - this.lastTick < TYPING) {
        this.rafId = requestAnimationFrame(function (t) { self._tick(t); });
        return;
      }
      var nextChar = term[this.charIndex];
      this.charIndex++;
      if (this.overlay) {
        this._appendChar(nextChar);
      } else {
        this.input.placeholder = 'Try "' + term.slice(0, this.charIndex) + '"';
      }
      this.lastTick = now;
      if (this.charIndex >= term.length) {
        this.deleting   = true;
        this.pauseUntil = now + HOLD;
      }
    } else {
      if (now - this.lastTick < DELETING) {
        this.rafId = requestAnimationFrame(function (t) { self._tick(t); });
        return;
      }
      this.charIndex--;
      if (this.overlay) {
        this._removeChar();
      } else {
        this.input.placeholder = this.charIndex > 0
          ? 'Try "' + term.slice(0, this.charIndex) + '"'
          : this.staticText;
      }
      this.lastTick = now;
      if (this.charIndex <= 0) {
        this.deleting   = false;
        this.termIndex  = (this.termIndex + 1) % this.terms.length;
        this.pauseUntil = now + GAP;
      }
    }

    this.rafId = requestAnimationFrame(function (t) { self._tick(t); });
  };

  /** Called externally (e.g. voice start) to freeze the animation. */
  AnimatedPlaceholder.prototype.pause = function (overridePlaceholder) {
    this._pause();
    if (overridePlaceholder) {
      if (this.overlay) this.overlay.style.display = 'none';
      this.input.placeholder = overridePlaceholder;
    }
  };

  /** Resume after an external pause (e.g. voice end/error). */
  AnimatedPlaceholder.prototype.resume = function () {
    if (this.input.value) return;
    this.paused    = false;
    this.charIndex = 0;
    this.deleting  = false;
    if (this.overlay) {
      this.input.placeholder = '';
      if (this.charsEl) this.charsEl.innerHTML = '';
      this._syncOverlayVisibility();
    } else {
      this.input.placeholder = this.staticText;
    }
    this._tick(performance.now());
  };

  AnimatedPlaceholder.prototype.destroy = function () {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  };


  /* ── HeaderSearch Instance ──────────────────────────────────────────── */

  function HeaderSearch(root) {
    this.root    = root;
    this.input   = root.querySelector('[data-search-input]');
    this.panel   = root.querySelector('[data-search-results]');
    this.clearBtn = root.querySelector('[data-search-clear]');
    this.voiceBtn = root.querySelector('[data-search-voice]');
    this.statusEl = root.querySelector('[data-search-status]');
    this.form     = root.querySelector('form');

    this.predictiveUrl = root.dataset.predictiveSearchUrl || '';
    this.searchUrl     = root.dataset.searchUrl || '/search';

    this.isPredictive = root.hasAttribute('data-predictive')
                        && !!this.predictiveUrl
                        && !!this.panel;

    /* Viewport suffix for deterministic ARIA IDs */
    this.sfx = root.classList.contains('header-search--desktop') ? 'desktop'
             : root.classList.contains('header-search--mobile')  ? 'mobile'
             : 'search';

    this.activeIndex   = -1;
    this.controller    = null;   /* AbortController for in-flight fetch */
    this._typewriter   = null;
    this._emptyVisible = false;  /* true while empty-state panel is shown */

    if (!this.input) return;

    /* Sync clear button + has-value class on init (handles pre-filled search.terms) */
    this._syncClear();
    this._syncHasValue();

    /* Clear button works with or without predictive search */
    this._bindClear();

    if (!this.isPredictive) return;

    this._bindInput();
    this._bindEmptyStateDelegation();
    this._bindKeyboard();
    this._bindDismiss();
    this._bindVoice();
    this._initTypewriter();
  }


  /* ── Clear Button ───────────────────────────────────────────────────── */

  /**
   * Single source of truth for clear-button visibility.
   * Called from every code path that can change input.value.
   */
  HeaderSearch.prototype._syncClear = function () {
    if (!this.clearBtn) return;
    this.clearBtn.hidden = this.input.value.length === 0;
  };

  /**
   * Single source of truth for the .header-search--has-value class,
   * which CSS uses to hide the typewriter overlay whenever the input
   * holds real text (the native input already hides its own placeholder
   * in that case, so this only needs to cover the decorative overlay).
   */
  HeaderSearch.prototype._syncHasValue = function () {
    this.root.classList.toggle('header-search--has-value', this.input.value.length > 0);
  };

  HeaderSearch.prototype._bindClear = function () {
    var self = this;

    /* Sync on every input event (typing, paste, browser autofill) */
    this.input.addEventListener('input',  function () { self._syncClear(); self._syncHasValue(); });
    /* Some autofill implementations fire 'change' but not 'input' */
    this.input.addEventListener('change', function () { self._syncClear(); self._syncHasValue(); });

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', function () {
        self.input.value = '';
        self._syncClear();
        self._syncHasValue();
        self.input.focus();
        if (self.isPredictive) {
          /* Show empty state rather than closing completely */
          self._showEmpty();
        }
      });
    }
  };


  /* ── Input / Focus Binding ──────────────────────────────────────────── */

  HeaderSearch.prototype._bindInput = function () {
    var self = this;
    var debouncedFetch = debounce(function (q) { self._fetch(q); }, DEBOUNCE_MS);

    this.input.addEventListener('input', function () {
      var q = self.input.value.trim();

      if (q.length >= MIN_QUERY_LENGTH) {
        self._emptyVisible = false;
        debouncedFetch(q);
      } else if (q.length === 0) {
        /* Cleared back to empty — show empty state */
        self._showEmpty();
      } else {
        /* 1 character — not enough to search, close gracefully */
        self.close();
      }
    });

    /* On focus: re-open whatever panel is appropriate */
    this.input.addEventListener('focus', function () {
      var q = self.input.value.trim();
      if (q.length >= MIN_QUERY_LENGTH) {
        self._fetch(q);
      } else {
        self._showEmpty();
      }
    });

    /* Save to recents on form submit */
    if (this.form) {
      this.form.addEventListener('submit', function () {
        var q = self.input.value.trim();
        if (q) RecentSearches.add(q);
        self.close();
      });
    }
  };


  /* ── Empty State ────────────────────────────────────────────────────── */

  /**
   * Delegated click handler on the panel, covering:
   *   [data-hs-remove-recent]  — remove one term, re-render
   *   [data-hs-clear-recent]   — clear all terms, re-render
   *   [data-hs-recent-term]    — save before navigating
   *   [data-hs-trending-term]  — save before navigating
   */
  HeaderSearch.prototype._bindEmptyStateDelegation = function () {
    var self = this;

    this.panel.addEventListener('click', function (e) {
      /* ✕ button — remove one recent term */
      var removeBtn = e.target.closest('[data-hs-remove-recent]');
      if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        RecentSearches.remove(removeBtn.dataset.hsRemoveRecent);
        self._showEmpty();
        self.input.focus();
        return;
      }

      /* "Clear all" button */
      var clearAllBtn = e.target.closest('[data-hs-clear-recent]');
      if (clearAllBtn) {
        e.preventDefault();
        RecentSearches.clear();
        self._showEmpty();
        self.input.focus();
        return;
      }

      /* Clicking a recent link — record the navigation term */
      var recentLink = e.target.closest('[data-hs-recent-term]');
      if (recentLink) {
        RecentSearches.add(recentLink.dataset.hsRecentTerm);
        return;
      }

      /* Clicking a trending pill — record the navigation term */
      var trendingLink = e.target.closest('[data-hs-trending-term]');
      if (trendingLink) {
        RecentSearches.add(trendingLink.dataset.hsTrendingTerm);
        return;
      }
    });
  };

  /** Render and display the empty/focus state panel. */
  HeaderSearch.prototype._showEmpty = function () {
    var trending = window.HS_TRENDING || [];
    var recent   = RecentSearches.load();
    var html     = buildEmptyState(trending, recent, this.searchUrl);

    if (!html) {
      /* Nothing to show (no trending, no recent) — close the panel */
      this.close();
      return;
    }

    this._emptyVisible = true;
    this.panel.innerHTML = html;
    this._open();
    this.activeIndex = -1;
    this._announce(this._buildEmptyAnnouncement(recent, trending));
  };

  HeaderSearch.prototype._buildEmptyAnnouncement = function (recent, trending) {
    var parts = [];
    if (recent.length)   parts.push(recent.length   + ' recent search'   + (recent.length   > 1 ? 'es' : ''));
    if (trending.length) parts.push(trending.length + ' trending search' + (trending.length > 1 ? 'es' : ''));
    return parts.length ? parts.join(' and ') + ' available' : '';
  };


  /* ── Fetch & Render ─────────────────────────────────────────────────── */

  HeaderSearch.prototype._fetch = function (query) {
    var self     = this;
    var key      = query.toLowerCase().trim();
    var cached   = _cache.get(key);

    if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
      this._renderResults(cached.html);
      return;
    }

    if (this.controller) this.controller.abort();
    this.controller = new AbortController();

    this._showLoading();

    var params = new URLSearchParams({
      q: query,
      section_id: 'predictive-search',
      'resources[type]': 'product,collection,query',
      'resources[limit]': '8',
      'resources[options][unavailable_products]': 'last',
    });

    fetch(this.predictiveUrl + '?' + params.toString(), {
      signal: this.controller.signal,
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var doc     = new DOMParser().parseFromString(text, 'text/html');
        var section = doc.querySelector('#shopify-section-predictive-search');
        var html    = section ? section.innerHTML : '';
        _cache.set(key, { html: html, ts: Date.now() });
        self._renderResults(html);
      })
      .catch(function (err) {
        if (err.name === 'AbortError') return;
        self._showError();
      });
  };

  HeaderSearch.prototype._showLoading = function () {
    this._emptyVisible = false;
    this.panel.innerHTML =
      '<p class="header-search__state">Searching\u2026</p>';
    this._open();
  };

  HeaderSearch.prototype._showError = function () {
    this._emptyVisible = false;
    this.panel.innerHTML =
      '<p class="header-search__state header-search__state--error">'
      + 'Search unavailable \u2014 press Enter to see full results.'
      + '</p>';
    this._open();
  };

  HeaderSearch.prototype._renderResults = function (html) {
    this._emptyVisible = false;
    this.panel.innerHTML = html;

    var optionCount = this.panel.querySelectorAll('[role="option"]').length;

    if (!optionCount) {
      this.panel.innerHTML =
        '<p class="header-search__state">No results found.</p>';
    }

    this._open();
    this.activeIndex = -1;
    this._announce(
      optionCount
        ? optionCount + ' result' + (optionCount === 1 ? '' : 's') + ' available'
        : 'No results found'
    );
  };

  /** Push a live-region announcement to screen readers. */
  HeaderSearch.prototype._announce = function (text) {
    if (this.statusEl) this.statusEl.textContent = text;
  };


  /* ── Open / Close ───────────────────────────────────────────────────── */

  HeaderSearch.prototype._open = function () {
    this.panel.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this.root.classList.add('header-search--open');
  };

  HeaderSearch.prototype.close = function () {
    this._emptyVisible = false;
    this.panel.hidden  = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.root.classList.remove('header-search--open');
    this.activeIndex = -1;
  };

  HeaderSearch.prototype._bindDismiss = function () {
    var self = this;
    document.addEventListener('click', function (e) {
      if (!self.root.contains(e.target)) self.close();
    });
  };


  /* ── Keyboard Navigation ────────────────────────────────────────────── */

  HeaderSearch.prototype._bindKeyboard = function () {
    var self = this;

    this.input.addEventListener('keydown', function (e) {
      /* Nothing to navigate if panel is closed, except Escape (no-op when closed) */
      if (self.panel.hidden) return;

      /*
       * Walker picks up ALL focusable children of [role="option"] elements,
       * covering: predictive result links, recent-search links, ✕ buttons,
       * trending pill links, and the view-all footer link.
       */
      var items = Array.prototype.slice.call(
        self.panel.querySelectorAll(
          '[role="option"] a, [role="option"] button, a[role="option"]'
        )
      );

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          self.activeIndex = Math.min(self.activeIndex + 1, items.length - 1);
          self._focusItem(items);
          break;

        case 'ArrowUp':
          e.preventDefault();
          self.activeIndex = Math.max(self.activeIndex - 1, -1);
          if (self.activeIndex === -1) {
            self.input.focus();
          } else {
            self._focusItem(items);
          }
          break;

        case 'Escape':
          self.close();
          self.input.focus();
          break;
      }
    });
  };

  /**
   * Move browser focus to the active item and update aria-activedescendant.
   * Uses stable, deterministic IDs (viewport suffix + index) instead of
   * random values so the DOM is predictable for testing and accessibility tools.
   */
  HeaderSearch.prototype._focusItem = function (items) {
    var el = items[this.activeIndex];
    if (!el) return;

    /* Find the [role="option"] ancestor to use as the ARIA target */
    var option = el.closest('[role="option"]') || el;
    if (option) {
      var stableId = 'HsOption-' + this.sfx + '-' + this.activeIndex;
      if (option.id !== stableId) option.id = stableId;
      this.input.setAttribute('aria-activedescendant', stableId);
    }

    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  };


  /* ── Voice Search ───────────────────────────────────────────────────── */

  HeaderSearch.prototype._bindVoice = function () {
    var self = this;
    var SR   = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !this.voiceBtn) return;

    /* Un-hide the button now that we know the API is available */
    this.voiceBtn.hidden = false;

    var recognition             = new SR();
    recognition.lang            = document.documentElement.lang || 'en-US';
    recognition.interimResults  = false;
    recognition.maxAlternatives = 1;

    recognition.addEventListener('result', function (e) {
      var transcript = (e.results[0][0].transcript || '').trim();
      self.input.value = transcript;
      self._syncClear();                /* update clear button */
      self._syncHasValue();             /* hide typewriter overlay */
      if (transcript) self._fetch(transcript);
    });

    recognition.addEventListener('start', function () {
      self.voiceBtn.classList.add('header-search__voice--listening');
      self.root.classList.add('header-search--listening');
      self.voiceBtn.setAttribute('aria-label', 'Listening\u2026 tap to stop');
      if (self._typewriter) self._typewriter.pause('Listening\u2026');
    });

    recognition.addEventListener('end', function () {
      self.voiceBtn.classList.remove('header-search__voice--listening');
      self.root.classList.remove('header-search--listening');
      self.voiceBtn.setAttribute('aria-label', 'Search by voice');
      if (self._typewriter && !self.input.value) self._typewriter.resume();
    });

    recognition.addEventListener('error', function (e) {
      self.voiceBtn.classList.remove('header-search__voice--listening');
      self.root.classList.remove('header-search--listening');
      self.voiceBtn.setAttribute('aria-label', 'Search by voice');
      /* If permission denied, hide the button permanently */
      if (e.error === 'not-allowed') self.voiceBtn.hidden = true;
      if (self._typewriter && !self.input.value) self._typewriter.resume();
    });

    this.voiceBtn.addEventListener('click', function () {
      try {
        recognition.start();
      } catch (_) {
        /* Recognition already in progress — ignore duplicate start */
      }
    });
  };


  /* ── Typewriter Placeholder ─────────────────────────────────────────── */

  HeaderSearch.prototype._initTypewriter = function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var terms = window.HS_TRENDING;
    if (!terms || !terms.length) return;
    var self    = this;
    var overlay = this.root.querySelector('[data-search-typewriter]');
    this._typewriter = new AnimatedPlaceholder(this.input, terms, overlay, function (hasValue) {
      self.root.classList.toggle('header-search--has-value', hasValue);
    });
  };


  /* ── Bootstrap ──────────────────────────────────────────────────────── */

  function init() {
    document.querySelectorAll('[data-search-root]').forEach(function (el) {
      if (!el._hsInstance) {
        el._hsInstance = new HeaderSearch(el);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Re-init after Shopify theme editor section reloads */
  document.addEventListener('shopify:section:load', function () {
    /* Clear stale instance flags so re-init creates fresh instances */
    document.querySelectorAll('[data-search-root]').forEach(function (el) {
      el._hsInstance = null;
    });
    init();
  });

})();