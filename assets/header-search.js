/**
 * Predictive Search — header-search.js
 * File: assets/header-search.js
 * Loaded by: sections/main-header.liquid  (defer)
 *
 * Self-contained — owns:
 *   • Category pill (open / close / select / ARIA)
 *   • Animated typewriter placeholder
 *   • Voice search (Web Speech API, graceful fallback)
 *   • Debounced Shopify predictive-search API calls
 *   • In-memory response cache (90 s TTL)
 *   • Recent searches (sessionStorage)
 *   • Trending pills
 *   • Keyboard navigation (↑ ↓ Enter Escape Tab)
 *   • Mobile bottom-sheet + backdrop + body scroll lock
 *   • ⌘K / Ctrl+K global shortcut → focus desktop instance
 *
 * Config is injected by snippets/header-search.liquid via
 *   window.HS_SETTINGS = { … }
 * before this file is parsed, so the Object.assign below picks it up.
 *
 * MASTER TOGGLE: HS_CONFIG.ENABLE_PREDICTIVE
 *   Set by window.HS_SETTINGS, which is only injected by
 *   snippets/search-modal.liquid — and that snippet is only rendered
 *   by snippets/header-search.liquid when "Enable predictive search"
 *   is on (Main Header section setting). If predictive search is off,
 *   window.HS_SETTINGS is never defined at all, so the default below
 *   MUST be false — defaulting to true here would mean "config script
 *   missing" gets silently treated as "predictive on," which is
 *   backwards.
 *   When false, both the desktop and mobile .hs instances still work
 *   as a plain GET form (they share this one global setting — see the
 *   note in snippets/header-search.liquid on why per-instance config
 *   was deliberately not built). Advanced behaviour is suppressed:
 *     - mic button is not injected
 *     - animated placeholder never starts
 *     - dropdown never opens on focus/input (no fetch calls fired)
 *   This keeps the same HeaderSearch class for both modes instead of
 *   forking into a second implementation.
 *
 * NOTE: Category tag filtering (activeCategory.value) scopes the section
 * label and "view all" URL correctly, but Shopify's /search/suggest.json
 * endpoint does not support tag: filtering in the q parameter — results
 * returned are always unfiltered by tag at the API level.
 *
 * BEM prefix: .hs  (matches header-search.css)
 */

'use strict';

/* ─── Config ───────────────────────────────────────────────────────────────── */

var HS_CONFIG = Object.assign(
  {
    MIN_QUERY_LENGTH:      2,
    DEBOUNCE_MS:           200,
    MAX_QUERIES:           3,
    MAX_PRODUCTS:          5,
    MAX_COLLECTIONS:       2,
    RECENT_SEARCHES_KEY:   'hs_recent',
    RECENT_SEARCHES_LIMIT: 5,
    TRENDING_SEARCHES:     [],
    CACHE_TTL_MS:          90000,
    VOICE_LANG:            'en-US',
    VOICE_ENABLED:         true,
    PLACEHOLDER_ANIMATE:   true,
    PLACEHOLDER_INTERVAL:  3200,
    PLACEHOLDER_STATIC:    'What are you looking for?',
    ENABLE_PREDICTIVE:     false,
  },
  window.HS_SETTINGS || {}
);

/* ─── In-memory cache ──────────────────────────────────────────────────────── */

var _cache = new Map();

function getCached(key) {
  var e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > HS_CONFIG.CACHE_TTL_MS) { _cache.delete(key); return null; }
  return e.data;
}
function setCache(key, data) { _cache.set(key, { data: data, ts: Date.now() }); }

/* ─── Utilities ────────────────────────────────────────────────────────────── */

function debounce(fn, ms) {
  var t;
  return function () {
    var ctx = this, args = arguments;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(ctx, args); }, ms);
  };
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function money(cents) {
  var n = parseFloat(cents);
  if (isNaN(n)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n);
}

function highlight(text, query) {
  if (!query || !text) return esc(text);
  var rx = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return esc(text).replace(rx, '<mark class="hs__highlight">$1</mark>');
}

function emit(name, detail) {
  document.dispatchEvent(new CustomEvent('hs:' + name, { detail: detail, bubbles: true }));
}

/* ─── sessionStorage helpers ───────────────────────────────────────────────── */

function getRecent() {
  try { return JSON.parse(sessionStorage.getItem(HS_CONFIG.RECENT_SEARCHES_KEY) || '[]'); }
  catch (e) { return []; }
}

function saveRecent(q) {
  if (!q || q.trim().length < 2) return;
  var clean = q.trim();
  var list = getRecent().filter(function (s) { return s.toLowerCase() !== clean.toLowerCase(); });
  list.unshift(clean);
  list = list.slice(0, HS_CONFIG.RECENT_SEARCHES_LIMIT);
  try { sessionStorage.setItem(HS_CONFIG.RECENT_SEARCHES_KEY, JSON.stringify(list)); } catch (e) {}
}

function removeRecent(q) {
  var list = getRecent().filter(function (s) { return s !== q; });
  try { sessionStorage.setItem(HS_CONFIG.RECENT_SEARCHES_KEY, JSON.stringify(list)); } catch (e) {}
}

function clearRecent() {
  try { sessionStorage.removeItem(HS_CONFIG.RECENT_SEARCHES_KEY); } catch (e) {}
}

/* ─── Animated Placeholder ─────────────────────────────────────────────────── */

function AnimatedPlaceholder(input, terms) {
  this.input      = input;
  this.terms      = (terms && terms.length) ? terms : [HS_CONFIG.PLACEHOLDER_STATIC];
  this.termIndex  = 0;
  this.charIndex  = 0;
  this.deleting   = false;
  this.paused     = false;
  this.rafId      = null;
  this.lastTick   = 0;
  this.pauseUntil = 0;

  var self = this;
  input.addEventListener('focus', function () { self.paused = true; });
  input.addEventListener('blur',  function () {
    if (!input.value) { self.paused = false; self._tick(performance.now()); }
  });
  this._tick(performance.now());
}

AnimatedPlaceholder.prototype._tick = function (now) {
  var self = this;
  if (this.paused || this.input.value) return;

  var TYPING   = 68;
  var DELETING = 36;
  var PAUSE_A  = HS_CONFIG.PLACEHOLDER_INTERVAL;
  var PAUSE_B  = 400;

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
    this.charIndex++;
    this.input.placeholder = 'Try "' + term.slice(0, this.charIndex) + '"';
    this.lastTick = now;
    if (this.charIndex >= term.length) { this.deleting = true; this.pauseUntil = now + PAUSE_A; }
  } else {
    if (now - this.lastTick < DELETING) {
      this.rafId = requestAnimationFrame(function (t) { self._tick(t); });
      return;
    }
    this.charIndex--;
    this.input.placeholder = this.charIndex > 0
      ? 'Try "' + term.slice(0, this.charIndex) + '"'
      : HS_CONFIG.PLACEHOLDER_STATIC;
    this.lastTick = now;
    if (this.charIndex <= 0) {
      this.deleting   = false;
      this.termIndex  = (this.termIndex + 1) % this.terms.length;
      this.pauseUntil = now + PAUSE_B;
    }
  }
  this.rafId = requestAnimationFrame(function (t) { self._tick(t); });
};

AnimatedPlaceholder.prototype.destroy = function () {
  if (this.rafId) cancelAnimationFrame(this.rafId);
};

/* ─── Voice Search ─────────────────────────────────────────────────────────── */

function VoiceSearch(opts) {
  opts = opts || {};
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { this.supported = false; return; }

  this.supported = true;
  this.listening = false;
  this.onStart   = opts.onStart  || function () {};
  this.onResult  = opts.onResult || function () {};
  this.onEnd     = opts.onEnd    || function () {};
  this.onError   = opts.onError  || function () {};

  var self = this;
  this._rec = new SR();
  this._rec.lang            = HS_CONFIG.VOICE_LANG;
  this._rec.interimResults  = true;
  this._rec.maxAlternatives = 1;
  this._rec.continuous      = false;

  this._rec.onstart  = function () { self.listening = true;  self.onStart(); };
  this._rec.onend    = function () { self.listening = false; self.onEnd(); };
  this._rec.onerror  = function (e) { self.listening = false; self.onError(e.error); };
  this._rec.onresult = function (e) {
    var interim = '', final = '';
    for (var i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) final   += e.results[i][0].transcript;
      else                       interim += e.results[i][0].transcript;
    }
    self.onResult(final || interim, !!final);
  };
}

VoiceSearch.prototype.toggle = function () {
  if (!this.supported) return;
  if (this.listening) { this._rec.stop(); }
  else { try { this._rec.start(); } catch (e) { this._rec.stop(); } }
};
VoiceSearch.prototype.stop = function () {
  if (this.supported && this.listening) this._rec.stop();
};

/* ─── Main Class ───────────────────────────────────────────────────────────── */

function HeaderSearch(root) {
  this.root = root;

  /* this.sfx must be unique per .hs instance — it's used to generate
     option element ids (_setActive) and to tag emitted analytics
     events. The element's own id attribute is "hs-{id_suffix}" (set by
     search-form.liquid — just "desktop" or "mobile", since there is
     now exactly one Header Search snippet per page), so we derive
     from that rather than from data-search-instance, which
     intentionally stays the plain "desktop"/"mobile" value too — that
     one is for viewport-targeting (e.g. the ⌘K shortcut, which wants
     "the desktop instance"). In practice the two are equivalent now;
     this.sfx is kept derived from root.id rather than collapsed into
     this.viewport in case a future change re-introduces a qualifier
     into the id (e.g. multiple search instances on one page again). */
  this.sfx = root.id ? root.id.replace(/^hs-/, '') : 'desktop';

  /* Plain viewport label ("desktop" | "mobile"). */
  this.viewport = root.dataset.searchInstance || 'desktop';

  this.form     = root.querySelector('.hs__form');
  this.input    = root.querySelector('.hs__input');
  this.clearBtn = root.querySelector('.hs__clear');

  this.catBtn    = root.querySelector('.hs__cat-btn');
  this.catList   = root.querySelector('.hs__cat-list');
  this.catLabel  = root.querySelector('.hs__cat-label');
  this.catHidden = root.querySelector('.hs__cat-value');

  this.activeCategory = { value: '', label: 'All' };
  this.activeIndex    = -1;
  this.isOpen         = false;
  this.lastQuery      = '';
  this.abortCtrl      = null;
  this.micBtn         = null;
  this.dropdown       = null;
  this.backdrop       = null;

  /* Master toggle — "Enable predictive search" (Main Header section setting).
     Architecture note: snippets/search-form.liquid (which renders this
     .hs root) NEVER contains dropdown/backdrop markup — that markup
     doesn't exist anywhere in Liquid. When predictive search is on,
     snippets/search-modal.liquid sets window.HS_SETTINGS.ENABLE_PREDICTIVE
     = true, and it's THIS constructor's job to create and append the
     .hs__dropdown / .hs__backdrop elements into `root` — see
     _createDropdownElements() below. If ENABLE_PREDICTIVE is false (or
     HS_SETTINGS was never injected because the setting is off), we
     skip element creation entirely and this instance behaves as a
     plain form. */
  this.predictiveEnabled = !!HS_CONFIG.ENABLE_PREDICTIVE;

  if (this.predictiveEnabled) {
    this._createDropdownElements();
  }

  if (!this.input) {
    console.warn('[HeaderSearch] Missing required input element in instance:', this.sfx);
    return;
  }

  /* Basic-mode instances have no dropdown — bail out before wiring any
     of the predictive-only behaviour. The form itself (category pill,
     clear button, submit) still works via native HTML form submission. */
  if (!this.predictiveEnabled) {
    this._bindBasicForm();
    this._bindCategory();
    return;
  }

  this.debouncedFetch = debounce(this._fetch.bind(this), HS_CONFIG.DEBOUNCE_MS);

  this._injectMic();
  this._bindForm();
  this._bindCategory();
  this._bindDropdown();
  this._bindDocument();
  this._initPlaceholder();
  this._initVoice();
}

/* ── Dropdown/backdrop element creation (predictive mode only) ───────────────
   These elements have no Liquid markup anywhere — search-form.liquid
   never renders them. We build them here, scoped with the same unique
   `this.sfx` used for every other id in this instance, and append them
   directly into `root` (the .hs wrapper), so the existing CSS
   positioning rules — `.hs__dropdown { position: absolute; top: ... }`,
   the mobile bottom-sheet override, `.hs__backdrop { position: fixed }`
   — all apply exactly as if this markup had been server-rendered. */
HeaderSearch.prototype._createDropdownElements = function () {
  var dropdown = document.createElement('div');
  dropdown.className = 'hs__dropdown';
  dropdown.id = 'hs-dropdown-' + this.sfx;
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-label', 'Search suggestions');
  dropdown.setAttribute('aria-live', 'polite');
  dropdown.hidden = true;

  var backdrop = document.createElement('div');
  backdrop.className = 'hs__backdrop';
  backdrop.id = 'hs-backdrop-' + this.sfx;
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.hidden = true;

  this.root.appendChild(dropdown);
  this.root.appendChild(backdrop);

  this.dropdown = dropdown;
  this.backdrop = backdrop;

  /* The input's aria-controls references this id — search-form.liquid
     only writes that attribute when `predictive` was true at render
     time, which corresponds 1:1 with HS_CONFIG.ENABLE_PREDICTIVE being
     true here, so the ids always match without further wiring. */
};

/* ── Basic-mode form binding (predictive search OFF) ─────────────────────────
   Just enough wiring to keep the clear button working; everything else
   (dropdown, fetch, voice, animated placeholder) is skipped entirely. */
HeaderSearch.prototype._bindBasicForm = function () {
  var self = this;

  this.input.addEventListener('input', function (e) {
    if (self.clearBtn) self.clearBtn.hidden = e.target.value.trim().length === 0;
  });

  if (this.clearBtn) {
    this.clearBtn.addEventListener('click', function () {
      self.input.value = '';
      self.input.focus();
      self.clearBtn.hidden = true;
    });
  }

  if (this.form) {
    this.form.addEventListener('submit', function (e) {
      var q = self.input.value.trim();
      if (!q) {
        // Mirror native behaviour: empty submissions are simply ignored.
        e.preventDefault();
        return;
      }
      emit('submitted', { query: q, category: self.activeCategory.value, instance: self.sfx });
      // No preventDefault — let the form GET-submit to routes.search_url normally.
    });
  }
};

/* ── Mic injection ────────────────────────────────────────────────────────── */

HeaderSearch.prototype._injectMic = function () {
  if (!this.form) return;
  var submit = this.form.querySelector('.hs__submit');
  if (!submit) return;

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hs__mic';
  btn.setAttribute('aria-label', 'Search by voice');
  btn.setAttribute('title', 'Search by voice');
  btn.innerHTML =
    '<svg class="hs__mic-icon hs__mic-icon--idle" width="16" height="16" viewBox="0 0 24 24"' +
      ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>' +
      '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
      '<line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>' +
    '</svg>' +
    '<svg class="hs__mic-icon hs__mic-icon--listening" width="16" height="16" viewBox="0 0 24 24"' +
      ' fill="currentColor" aria-hidden="true" style="display:none">' +
      '<rect x="9" y="2" width="6" height="12" rx="3"/>' +
      '<path fill="none" stroke="currentColor" stroke-width="2" d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
      '<line stroke="currentColor" stroke-width="2" x1="12" y1="19" x2="12" y2="23"/>' +
      '<line stroke="currentColor" stroke-width="2" x1="8"  y1="23" x2="16" y2="23"/>' +
    '</svg>';

  this.micBtn = btn;
  submit.before(btn);
};

/* ── Animated placeholder ─────────────────────────────────────────────────── */

HeaderSearch.prototype._initPlaceholder = function () {
  if (!HS_CONFIG.PLACEHOLDER_ANIMATE) return;
  var terms = HS_CONFIG.TRENDING_SEARCHES;
  if (!terms || !terms.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  this._placeholder = new AnimatedPlaceholder(this.input, terms);
};

/* ── Voice ────────────────────────────────────────────────────────────────── */

HeaderSearch.prototype._initVoice = function () {
  var self = this;

  if (!HS_CONFIG.VOICE_ENABLED) {
    if (self.micBtn) self.micBtn.hidden = true;
    return;
  }

  this._voice = new VoiceSearch({
    onStart: function () {
      self.micBtn.classList.add('hs__mic--listening');
      self.root.classList.add('hs--listening');
      self.micBtn.setAttribute('aria-label', 'Listening… tap to stop');
      self.micBtn.querySelector('.hs__mic-icon--idle').style.display      = 'none';
      self.micBtn.querySelector('.hs__mic-icon--listening').style.display = '';
      if (self._placeholder) self._placeholder.paused = true;
      self.input.placeholder = 'Listening…';
    },
    onResult: function (transcript, isFinal) {
      self.input.value = transcript;
      if (self.clearBtn) self.clearBtn.hidden = false;
      if (transcript.trim().length >= HS_CONFIG.MIN_QUERY_LENGTH) {
        self._showLoading();
        if (isFinal) self._fetch(transcript.trim());
        else         self.debouncedFetch(transcript.trim());
      }
      emit('voice_result', { transcript: transcript, isFinal: isFinal, instance: self.sfx });
    },
    onEnd: function () {
      if (!self.micBtn) return;
      self.micBtn.classList.remove('hs__mic--listening');
      self.root.classList.remove('hs--listening');
      self.micBtn.setAttribute('aria-label', 'Search by voice');
      self.micBtn.querySelector('.hs__mic-icon--idle').style.display      = '';
      self.micBtn.querySelector('.hs__mic-icon--listening').style.display = 'none';
      if (!self.input.value && self._placeholder) {
        self._placeholder.paused = false;
        self._placeholder._tick(performance.now());
      }
    },
    onError: function (code) {
      if (code === 'not-allowed' && self.micBtn) self.micBtn.hidden = true;
      if (self._voice) self._voice.onEnd();
      emit('voice_error', { code: code, instance: self.sfx });
    },
  });

  if (!this._voice.supported) {
    if (this.micBtn) this.micBtn.hidden = true;
    return;
  }

  if (this.micBtn) {
    this.micBtn.addEventListener('click', function () { self._voice.toggle(); });
  }
};

/* ── Form events ──────────────────────────────────────────────────────────── */

HeaderSearch.prototype._bindForm = function () {
  var self = this;

  this.input.addEventListener('input', function (e) {
    var q = e.target.value.trim();
    if (self.clearBtn) self.clearBtn.hidden = q.length === 0;
    if (q.length < HS_CONFIG.MIN_QUERY_LENGTH) {
      if (q.length === 0) self._showEmptyFocus();
      else self.closeDropdown();
      return;
    }
    self._showLoading();
    self.debouncedFetch(q);
  });

  this.input.addEventListener('focus', function () {
    var q = self.input.value.trim();
    if (q.length >= HS_CONFIG.MIN_QUERY_LENGTH) {
      if (q === self.lastQuery && self.isOpen) return;
      self._showLoading();
      self.debouncedFetch(q);
    } else {
      self._showEmptyFocus();
    }
  });

  this.input.addEventListener('keydown', function (e) { self._onKeydown(e); });

  if (this.clearBtn) {
    this.clearBtn.addEventListener('click', function () {
      self.input.value = '';
      self.input.focus();
      self.clearBtn.hidden = true;
      if (self._voice) self._voice.stop();
      self._showEmptyFocus();
      emit('cleared', { instance: self.sfx });
    });
  }

  if (this.form) {
    this.form.addEventListener('submit', function () {
      var q = self.input.value.trim();
      if (q.length > 0) {
        saveRecent(q);
        emit('submitted', { query: q, category: self.activeCategory.value, instance: self.sfx });
      }
      self.closeDropdown();
    });
  }
};

/* ── Category pill ────────────────────────────────────────────────────────── */

HeaderSearch.prototype._bindCategory = function () {
  var self = this;
  if (!this.catBtn || !this.catList) return;

  this.catBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var isOpen = self.catBtn.getAttribute('aria-expanded') === 'true';
    if (isOpen) self._closeCatList();
    else        self._openCatList();
  });

  this.catList.addEventListener('click', function (e) {
    var opt = e.target.closest('[role="option"]');
    if (!opt) return;
    self._selectCategory(opt.dataset.value || '', opt.dataset.label || 'All');
  });

  this.catList.addEventListener('keydown', function (e) {
    var opts = Array.prototype.slice.call(self.catList.querySelectorAll('[role="option"]'));
    var idx  = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      var next = opts[idx + 1] || opts[0];
      next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      var prev = opts[idx - 1] || opts[opts.length - 1];
      prev.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (document.activeElement && document.activeElement.dataset) {
        self._selectCategory(
          document.activeElement.dataset.value || '',
          document.activeElement.dataset.label || 'All'
        );
      }
    } else if (e.key === 'Escape') {
      self._closeCatList();
      self.catBtn.focus();
    }
  });
};

HeaderSearch.prototype._openCatList = function () {
  this.catList.hidden = false;
  this.catBtn.setAttribute('aria-expanded', 'true');
  var first = this.catList.querySelector('[role="option"]');
  if (first) first.focus();
};

HeaderSearch.prototype._closeCatList = function () {
  this.catList.hidden = true;
  this.catBtn.setAttribute('aria-expanded', 'false');
};

HeaderSearch.prototype._selectCategory = function (value, label) {
  this.activeCategory = { value: value, label: label };
  if (this.catLabel)  this.catLabel.textContent = label || 'All';
  if (this.catHidden) this.catHidden.value = value;

  if (this.catList) {
    var opts = this.catList.querySelectorAll('[role="option"]');
    opts.forEach(function (o) {
      o.setAttribute('aria-selected', (o.dataset.value || '') === value ? 'true' : 'false');
    });
  }

  this._closeCatList();

  /* In basic mode there's no dropdown/_fetch to trigger — selecting a
     category just sets the hidden q[category] field for the next
     native form submission. */
  if (!this.predictiveEnabled) return;

  var q = this.input.value.trim();
  if (q.length >= HS_CONFIG.MIN_QUERY_LENGTH) {
    this._showLoading();
    this._fetch(q);
  }
};

/* ── Dropdown events ──────────────────────────────────────────────────────── */

HeaderSearch.prototype._bindDropdown = function () {
  var self = this;

  this.dropdown.addEventListener('click', function (e) {
    var removeBtn = e.target.closest('[data-action="remove-recent"]');
    if (removeBtn) {
      e.preventDefault(); e.stopPropagation();
      removeRecent(removeBtn.dataset.term);
      self._showEmptyFocus();
      return;
    }

    if (e.target.closest('[data-action="clear-all"]')) {
      clearRecent(); self._showEmptyFocus(); return;
    }

    var pill = e.target.closest('[data-action="trending"]');
    if (pill) {
      self.input.value = pill.dataset.query;
      if (self.clearBtn) self.clearBtn.hidden = false;
      self._showLoading();
      self._fetch(pill.dataset.query);
      return;
    }

    var recentItem = e.target.closest('[data-type="recent"]');
    if (recentItem && !e.target.closest('[data-action]')) {
      var term = recentItem.dataset.query;
      if (term) { self.input.value = term; self._showLoading(); self._fetch(term); }
      return;
    }

    var qItem = e.target.closest('[data-type="query"]');
    if (qItem) {
      var q = qItem.dataset.query;
      if (q) { self.input.value = q; saveRecent(q); }
      emit('result_click', { query: self.input.value, type: 'query', pos: +qItem.dataset.pos, instance: self.sfx });
    }

    var pItem = e.target.closest('[data-type="product"]');
    if (pItem) {
      saveRecent(self.input.value);
      emit('result_click', { query: self.input.value, type: 'product', id: pItem.dataset.id, pos: +pItem.dataset.pos, instance: self.sfx });
    }

    var cItem = e.target.closest('[data-type="collection"]');
    if (cItem) {
      saveRecent(self.input.value);
      emit('result_click', { query: self.input.value, type: 'collection', id: cItem.dataset.id, pos: +cItem.dataset.pos, instance: self.sfx });
    }
  });
};

/* ── Document-level events ────────────────────────────────────────────────── */

HeaderSearch.prototype._bindDocument = function () {
  var self = this;

  document.addEventListener('click', function (e) {
    if (self.catList && !self.catList.hidden && !self.root.contains(e.target)) {
      self._closeCatList();
    }
    if (self.isOpen && !self.root.contains(e.target)) {
      self.closeDropdown();
    }
  });

  if (this.backdrop) {
    this.backdrop.addEventListener('click', function () { self.closeDropdown(); });
  }
};

/* ── Fetch ────────────────────────────────────────────────────────────────── */

HeaderSearch.prototype._fetch = function (query) {
  var self   = this;
  var cKey   = query + '|' + this.activeCategory.value;
  var cached = getCached(cKey);
  if (cached) { self._renderResults(cached, query); return; }

  if (this.abortCtrl) this.abortCtrl.abort();
  this.abortCtrl = new AbortController();

  var params = new URLSearchParams({
    q: query,
    'resources[type]':  'product,collection,query',
    'resources[limit]': '6',
    'resources[options][unavailable_products]': 'hide',
    'resources[options][fields]': 'title,product_type,variants.title,vendor,tag',
  });

  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  fetch(root + 'search/suggest.json?' + params.toString(), {
    signal: this.abortCtrl.signal,
  })
  .then(function (res) {
    if (!res.ok) {
      return res.text().then(function (body) {
        throw new Error('HTTP ' + res.status + ' — ' + body.slice(0, 300));
      });
    }
    return res.json();
  })
  .then(function (data) {
    setCache(cKey, data);
    self.lastQuery = query;
    self._renderResults(data, query);
    emit('results', {
      query:           query,
      category:        self.activeCategory.value,
      productCount:    ((data.resources && data.resources.results && data.resources.results.products)    || []).length,
      collectionCount: ((data.resources && data.resources.results && data.resources.results.collections) || []).length,
      queryCount:      ((data.resources && data.resources.results && data.resources.results.queries)     || []).length,
      instance:        self.sfx,
    });
  })
  .catch(function (err) {
    if (err.name === 'AbortError') return;
    console.error('[HeaderSearch] fetch error:', err);
    self._renderError();
  });
};

/* ── Render results ───────────────────────────────────────────────────────── */

HeaderSearch.prototype._renderResults = function (data, query) {
  var res      = (data.resources && data.resources.results) || {};
  var queries  = (res.queries     || []).slice(0, HS_CONFIG.MAX_QUERIES);
  var products = (res.products    || []).slice(0, HS_CONFIG.MAX_PRODUCTS);
  var cols     = (res.collections || []).slice(0, HS_CONFIG.MAX_COLLECTIONS);
  var hasAny   = queries.length || products.length || cols.length;

  if (!hasAny) {
    this._renderEmpty(query);
    emit('zero_results', { query: query, category: this.activeCategory.value, instance: this.sfx });
    return;
  }

  var html = '<div class="hs__sr-announce" role="status" aria-live="polite">' +
    (products.length + queries.length + cols.length) + ' results available</div>';

  /* Query suggestions */
  if (queries.length) {
    html += '<div class="hs__section hs__section--queries">';
    queries.forEach(function (item, i) {
      html +=
        '<a href="/search?q=' + encodeURIComponent(item.text) + '&type=product"' +
          ' class="hs__item hs__item--query hs__item--animate"' +
          ' style="--hs-row-index:' + i + '"' +
          ' role="option" data-type="query" data-query="' + esc(item.text) + '" data-pos="' + i + '">' +
          '<span class="hs__item-icon" aria-hidden="true">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
            '</svg>' +
          '</span>' +
          '<span class="hs__item-text">' + highlight(item.text, query) + '</span>' +
          '<span class="hs__item-arrow" aria-hidden="true">↗</span>' +
        '</a>';
    });
    html += '</div>';
  }

  /* Products */
  if (products.length) {
    var sectionLabel = this.activeCategory.value
      ? 'Products in ' + this.activeCategory.label
      : 'Products';
    html += '<div class="hs__section hs__section--products">' +
      '<p class="hs__section-label">' + esc(sectionLabel) + '</p>';

    var qOff = queries.length;
    products.forEach(function (p, i) {
      var price = p.price
        ? money(p.price)
        : (p.variants && p.variants[0] && p.variants[0].price ? money(p.variants[0].price) : '');

      var imgSrc = p.featured_image && p.featured_image.url
        ? p.featured_image.url.replace(/(\.\w+)(\?|$)/, '_80x80$1$2')
        : null;

      var imgHtml = imgSrc
        ? '<img src="' + esc(imgSrc) + '" alt="' + esc(p.title) + '" width="48" height="48" loading="lazy" class="hs__product-img">'
        : '<span class="hs__product-img hs__product-img--placeholder" aria-hidden="true">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
              '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l4-4 4 4 4-4 4 4"/>' +
            '</svg>' +
          '</span>';

      var badge = p.available === false
        ? '<span class="hs__product-badge hs__product-badge--oos">Out of stock</span>'
        : '';

      html +=
        '<a href="/products/' + esc(p.handle) + '"' +
          ' class="hs__item hs__item--product hs__item--animate"' +
          ' style="--hs-row-index:' + (qOff + i) + '"' +
          ' role="option" data-type="product" data-id="' + esc(p.id) + '" data-pos="' + i + '">' +
          '<span class="hs__product-media">' + imgHtml + '</span>' +
          '<span class="hs__product-info">' +
            '<span class="hs__product-title">' + highlight(p.title, query) + '</span>' +
            '<span class="hs__product-meta">' +
              (price ? '<span class="hs__product-price">' + esc(price) + '</span>' : '') +
              badge +
            '</span>' +
          '</span>' +
        '</a>';
    });
    html += '</div>';
  }

  /* Collections — hidden when category filter active */
  if (cols.length && !this.activeCategory.value) {
    var cOff = queries.length + products.length;
    html += '<div class="hs__section hs__section--collections"><p class="hs__section-label">Collections</p>';
    cols.forEach(function (col, i) {
      html +=
        '<a href="/collections/' + esc(col.handle) + '"' +
          ' class="hs__item hs__item--collection hs__item--animate"' +
          ' style="--hs-row-index:' + (cOff + i) + '"' +
          ' role="option" data-type="collection" data-id="' + esc(col.id) + '" data-pos="' + i + '">' +
          '<span class="hs__item-icon hs__item-icon--folder" aria-hidden="true">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' +
            '</svg>' +
          '</span>' +
          '<span class="hs__item-text">' + highlight(col.title, query) + '</span>' +
          (col.products_count
            ? '<span class="hs__item-count" aria-label="' + col.products_count + ' products">' + col.products_count + ' items</span>'
            : '') +
        '</a>';
    });
    html += '</div>';
  }

  /* View all */
  var viewHref = '/search?q=' + encodeURIComponent(query) + '&type=product' +
    (this.activeCategory.value ? '&tag=' + encodeURIComponent(this.activeCategory.value) : '');

  html +=
    '<div class="hs__section hs__section--footer">' +
      '<a href="' + viewHref + '" class="hs__view-all" role="option" data-type="view_all">' +
        'View all results for <strong>"' + esc(query) + '"</strong>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M5 12h14M12 5l7 7-7 7"/>' +
        '</svg>' +
      '</a>' +
    '</div>';

  this.dropdown.innerHTML = html;
  this.openDropdown();
  this.activeIndex = -1;
};

/* ── Loading skeleton ─────────────────────────────────────────────────────── */

HeaderSearch.prototype._showLoading = function () {
  var row = function (delay) {
    return '<div class="hs__skeleton-row" aria-hidden="true" style="animation-delay:' + delay + 'ms">' +
      '<div class="hs__skeleton hs__skeleton--icon"></div>' +
      '<div class="hs__skeleton-content">' +
        '<div class="hs__skeleton hs__skeleton--title"></div>' +
        '<div class="hs__skeleton hs__skeleton--subtitle"></div>' +
      '</div>' +
    '</div>';
  };
  this.dropdown.innerHTML =
    '<div class="hs__loading" aria-label="Loading results" role="status">' +
      row(0) + row(80) + row(160) +
    '</div>';
  this.openDropdown();
};

/* ── Empty focus (recent + trending) ─────────────────────────────────────── */

HeaderSearch.prototype._showEmptyFocus = function () {
  var recent   = getRecent();
  var trending = HS_CONFIG.TRENDING_SEARCHES;
  var html     = '';

  if (recent.length) {
    html += '<div class="hs__section hs__section--recent">' +
      '<div class="hs__section-header">' +
        '<p class="hs__section-label">Recent</p>' +
        '<button type="button" class="hs__clear-recent" data-action="clear-all">Clear all</button>' +
      '</div>';

    recent.forEach(function (term, i) {
      html +=
        '<div class="hs__item hs__item--recent hs__item--animate"' +
          ' style="--hs-row-index:' + i + '"' +
          ' role="option" data-type="recent" data-query="' + esc(term) + '" data-pos="' + i + '">' +
          '<span class="hs__item-icon" aria-hidden="true">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>' +
            '</svg>' +
          '</span>' +
          '<span class="hs__item-text">' + esc(term) + '</span>' +
          '<button type="button" class="hs__remove-recent"' +
            ' data-action="remove-recent" data-term="' + esc(term) + '"' +
            ' aria-label="Remove ' + esc(term) + ' from recent searches">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
        '</div>';
    });
    html += '</div>';
  }

  if (trending.length) {
    html += '<div class="hs__section hs__section--trending">' +
      '<p class="hs__section-label">Trending</p>' +
      '<div class="hs__trending-pills">';
    trending.forEach(function (term) {
      html += '<button type="button" class="hs__trending-pill" data-action="trending" data-query="' + esc(term) + '">' + esc(term) + '</button>';
    });
    html += '</div></div>';
  }

  if (html) { this.dropdown.innerHTML = html; this.openDropdown(); }
  else       { this.closeDropdown(); }
};

/* ── Empty / error states ─────────────────────────────────────────────────── */

HeaderSearch.prototype._renderEmpty = function (query) {
  var suggestions = HS_CONFIG.TRENDING_SEARCHES.slice(0, 3);
  var pills = suggestions.map(function (s) {
    return '<button type="button" class="hs__trending-pill" data-action="trending" data-query="' + esc(s) + '">' + esc(s) + '</button>';
  }).join('');

  this.dropdown.innerHTML =
    '<div class="hs__empty">' +
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
        '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
        '<line x1="8" y1="11" x2="14" y2="11"/>' +
      '</svg>' +
      '<p class="hs__empty-title">No results for <em>"' + esc(query) + '"</em></p>' +
      '<p class="hs__empty-hint">Try:</p>' +
      '<div class="hs__trending-pills">' + pills + '</div>' +
    '</div>';
  this.openDropdown();
};

HeaderSearch.prototype._renderError = function () {
  this.dropdown.innerHTML =
    '<div class="hs__empty hs__empty--error">' +
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="10"/>' +
        '<line x1="12" y1="8" x2="12" y2="12"/>' +
        '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
      '</svg>' +
      '<p class="hs__empty-title">Search unavailable</p>' +
      '<p class="hs__empty-hint">Please try again in a moment.</p>' +
    '</div>';
  this.openDropdown();
};

/* ── Open / close dropdown ────────────────────────────────────────────────── */

HeaderSearch.prototype.openDropdown = function () {
  this.dropdown.hidden = false;
  this.isOpen = true;
  this.input.setAttribute('aria-expanded', 'true');
  this.root.classList.add('hs--open');

  if (this.backdrop && window.innerWidth < 768) {
    this.backdrop.hidden = false;
    document.body.classList.add('hs-lock');
  }
};

HeaderSearch.prototype.closeDropdown = function () {
  this.dropdown.hidden = true;
  this.isOpen = false;
  this.activeIndex = -1;
  this.input.setAttribute('aria-expanded', 'false');
  this.input.removeAttribute('aria-activedescendant');
  this.root.classList.remove('hs--open');
  if (this.backdrop) this.backdrop.hidden = true;
  document.body.classList.remove('hs-lock');
};

/* ── Keyboard navigation ──────────────────────────────────────────────────── */

HeaderSearch.prototype._onKeydown = function (e) {
  var self = this;

  if (!this.isOpen) {
    if (e.key === 'ArrowDown') { e.preventDefault(); this._showEmptyFocus(); }
    return;
  }

  var items = Array.prototype.slice.call(
    this.dropdown.querySelectorAll('.hs__item, .hs__view-all')
  );

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
      this._setActive(items);
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (this.activeIndex <= 0) {
        this.activeIndex = -1;
        this.input.removeAttribute('aria-activedescendant');
        items.forEach(function (el) { el.classList.remove('hs__item--active'); });
      } else {
        this.activeIndex--;
        this._setActive(items);
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
};

HeaderSearch.prototype._setActive = function (items) {
  var self = this;
  items.forEach(function (el, i) {
    var active = i === self.activeIndex;
    el.classList.toggle('hs__item--active', active);
    el.id = el.id || ('hs-opt-' + self.sfx + '-' + i);
    if (active) {
      self.input.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    }
  });
};

/* ─── Auto-init ────────────────────────────────────────────────────────────── */

function initHeaderSearch() {
  document.querySelectorAll('[data-search-instance]').forEach(function (el) {
    if (!el._headerSearch) {
      el._headerSearch = new HeaderSearch(el);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeaderSearch);
} else {
  initHeaderSearch();
}

/* Re-init after Shopify section reloads (theme editor) */
document.addEventListener('shopify:section:load', initHeaderSearch);

/* ─── ⌘K / Ctrl+K — focus desktop search ──────────────────────────────────── */

document.addEventListener('keydown', function (e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    var target =
      document.querySelector('[data-search-instance="desktop"] .hs__input') ||
      document.querySelector('.hs__input');
    if (target) target.focus();
  }
});

/* ─── Analytics bridge (uncomment + wire to your analytics) ────────────────── */
// document.addEventListener('hs:result_click', function (e) {
//   gtag('event', 'select_content', { content_type: e.detail.type, item_id: e.detail.id });
// });
// document.addEventListener('hs:submitted', function (e) {
//   gtag('event', 'search', { search_term: e.detail.query });
// });
// document.addEventListener('hs:voice_result', function (e) {
//   gtag('event', 'voice_search', { search_term: e.detail.transcript });
// });
// document.addEventListener('hs:zero_results', function (e) {
//   gtag('event', 'zero_results', { search_term: e.detail.query });
// });