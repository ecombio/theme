'use strict';

(function () {

  var MIN_QUERY_LENGTH = 2;
  var DEBOUNCE_MS      = 300;
  var CACHE_TTL_MS     = 60000;
  var MAX_RECENT       = 5;

  var _cache = new Map();

  var STORAGE_KEY = 'HS_RECENT_' + window.location.hostname;


  function debounce(fn, wait) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function esc(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#x27;');
  }


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


  function buildEmptyState(trending, recent, searchUrl) {
    var html = '';

    if (recent.length) {
      html += '<div class="hs-empty__group">';

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
        '<span class="hs-tw-prefix">Search for </span>'
        + '<span class="hs-tw-chars"></span>';
      this.charsEl = this.overlay.querySelector('.hs-tw-chars');
      input.placeholder = '';
    }

    input.addEventListener('input', function () {
      if (input.value) {
        if (!self.paused) self._pause();
      } else {
        if (self.paused) self.resume();
      }
    });

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
    var TYPING   = 68;
    var DELETING = 36;
    var HOLD     = 3200;
    var GAP      = 400;

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
        this.input.placeholder = 'Search for ' + term.slice(0, this.charIndex);
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
          ? 'Search for ' + term.slice(0, this.charIndex)
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

  AnimatedPlaceholder.prototype.pause = function (overridePlaceholder) {
    this._pause();
    if (overridePlaceholder) {
      if (this.overlay) this.overlay.style.display = 'none';
      this.input.placeholder = overridePlaceholder;
    }
  };

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

    this.sfx = root.classList.contains('header-search--desktop') ? 'desktop'
             : root.classList.contains('header-search--mobile')  ? 'mobile'
             : 'search';

    this.activeIndex   = -1;
    this.controller    = null;
    this._typewriter   = null;
    this._emptyVisible = false;

    if (!this.input) return;

    this._syncClear();
    this._syncHasValue();

    this._bindClear();

    if (!this.isPredictive) return;

    this._bindInput();
    this._bindEmptyStateDelegation();
    this._bindKeyboard();
    this._bindDismiss();
    this._bindVoice();
    this._initTypewriter();
  }


  HeaderSearch.prototype._syncClear = function () {
    if (!this.clearBtn) return;
    this.clearBtn.hidden = this.input.value.length === 0;
  };

  HeaderSearch.prototype._syncHasValue = function () {
    this.root.classList.toggle('header-search--has-value', this.input.value.length > 0);
  };

  HeaderSearch.prototype._bindClear = function () {
    var self = this;

    this.input.addEventListener('input',  function () { self._syncClear(); self._syncHasValue(); });
    this.input.addEventListener('change', function () { self._syncClear(); self._syncHasValue(); });

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', function () {
        self.input.value = '';
        self._syncClear();
        self._syncHasValue();
        self.input.focus();
        if (self.isPredictive) {
          self._showEmpty();
        }
      });
    }
  };


  HeaderSearch.prototype._bindInput = function () {
    var self = this;
    var debouncedFetch = debounce(function (q) { self._fetch(q); }, DEBOUNCE_MS);

    this.input.addEventListener('input', function () {
      var q = self.input.value.trim();

      if (q.length >= MIN_QUERY_LENGTH) {
        self._emptyVisible = false;
        debouncedFetch(q);
      } else if (q.length === 0) {
        self._showEmpty();
      } else {
        self.close();
      }
    });

    this.input.addEventListener('focus', function () {
      var q = self.input.value.trim();
      if (q.length >= MIN_QUERY_LENGTH) {
        self._fetch(q);
      } else {
        self._showEmpty();
      }
    });

    if (this.form) {
      this.form.addEventListener('submit', function () {
        var q = self.input.value.trim();
        if (q) RecentSearches.add(q);
        self.close();
      });
    }
  };


  HeaderSearch.prototype._bindEmptyStateDelegation = function () {
    var self = this;

    this.panel.addEventListener('click', function (e) {
      var removeBtn = e.target.closest('[data-hs-remove-recent]');
      if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        RecentSearches.remove(removeBtn.dataset.hsRemoveRecent);
        self._showEmpty();
        self.input.focus();
        return;
      }

      var clearAllBtn = e.target.closest('[data-hs-clear-recent]');
      if (clearAllBtn) {
        e.preventDefault();
        RecentSearches.clear();
        self._showEmpty();
        self.input.focus();
        return;
      }

      var recentLink = e.target.closest('[data-hs-recent-term]');
      if (recentLink) {
        RecentSearches.add(recentLink.dataset.hsRecentTerm);
        return;
      }

      var trendingLink = e.target.closest('[data-hs-trending-term]');
      if (trendingLink) {
        RecentSearches.add(trendingLink.dataset.hsTrendingTerm);
        return;
      }
    });
  };

  HeaderSearch.prototype._showEmpty = function () {
    var trending = window.HS_TRENDING || [];
    var recent   = RecentSearches.load();
    var html     = buildEmptyState(trending, recent, this.searchUrl);

    if (!html) {
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

  HeaderSearch.prototype._announce = function (text) {
    if (this.statusEl) this.statusEl.textContent = text;
  };


  HeaderSearch.prototype._open = function () {
    this.panel.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this.root.classList.add('header-search--open');
    document.dispatchEvent(new CustomEvent('header-search:open'));
  };

  HeaderSearch.prototype.close = function () {
    this._emptyVisible = false;
    this.panel.hidden  = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.root.classList.remove('header-search--open');
    this.activeIndex = -1;
    document.dispatchEvent(new CustomEvent('header-search:close'));
  };

  HeaderSearch.prototype._bindDismiss = function () {
    var self = this;
    document.addEventListener('click', function (e) {
      if (!self.root.contains(e.target)) self.close();
    });
  };


  HeaderSearch.prototype._bindKeyboard = function () {
    var self = this;

    this.input.addEventListener('keydown', function (e) {
      if (self.panel.hidden) return;

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

  HeaderSearch.prototype._focusItem = function (items) {
    var el = items[this.activeIndex];
    if (!el) return;

    var option = el.closest('[role="option"]') || el;
    if (option) {
      var stableId = 'HsOption-' + this.sfx + '-' + this.activeIndex;
      if (option.id !== stableId) option.id = stableId;
      this.input.setAttribute('aria-activedescendant', stableId);
    }

    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  };


  HeaderSearch.prototype._bindVoice = function () {
    var self = this;
    var SR   = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !this.voiceBtn) return;

    this.voiceBtn.hidden = false;

    var recognition             = new SR();
    recognition.lang            = document.documentElement.lang || 'en-US';
    recognition.interimResults  = false;
    recognition.maxAlternatives = 1;

    recognition.addEventListener('result', function (e) {
      var transcript = (e.results[0][0].transcript || '').trim();
      self.input.value = transcript;
      self._syncClear();
      self._syncHasValue();
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
      if (e.error === 'not-allowed') self.voiceBtn.hidden = true;
      if (self._typewriter && !self.input.value) self._typewriter.resume();
    });

    this.voiceBtn.addEventListener('click', function () {
      try {
        recognition.start();
      } catch (_) {
      }
    });
  };


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

  document.addEventListener('shopify:section:load', function () {
    document.querySelectorAll('[data-search-root]').forEach(function (el) {
      el._hsInstance = null;
    });
    init();
  });

})();