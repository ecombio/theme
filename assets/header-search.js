/**
 * header-search.js — Search shell behaviour
 * ============================================================================
 *
 * Responsibility: typewriter placeholder animation — a purely visual shell
 * enhancement. Zero network calls. Zero panel management.
 *
 * Panel open/close, fetch, and abort logic all live in predictive-search.js.
 * This file does not call predictive-search.js and is not called by it.
 * Both files share only the data-search-* contract on the DOM.
 *
 * CONTRACT (data attributes set by header-search.liquid — never changes here):
 *   [data-search-root]   Subsystem mount point
 *   [data-search-input]  Text input to animate
 *
 * TYPEWRITER BEHAVIOUR:
 *   Cycles through SUGGESTIONS, typing then deleting each term.
 *   Stops the moment the user focuses the input or begins typing.
 *   Restarts when the user clears the input and blurs away.
 *
 * ============================================================================
 */

(function () {
  'use strict';


  // ── MOUNT ──────────────────────────────────────────────────────────────────

  const root  = document.querySelector('[data-search-root]');
  if (!root) return;

  const input = root.querySelector('[data-search-input]');
  if (!input) return;


  // ── CONFIG ─────────────────────────────────────────────────────────────────

  const SUGGESTIONS = [
    'running shoes',
    'protein powder',
    'gym gloves',
    'resistance bands',
    'yoga mat',
    'pre-workout',
    'compression socks',
  ];

  const TYPEWRITER = {
    speed:       80,   // ms per character typed
    deleteSpeed: 40,   // ms per character deleted
    pauseAfter:  1800, // ms to hold the completed word
    pauseBefore: 400,  // ms before typing the next word
  };


  // ── STATE ──────────────────────────────────────────────────────────────────

  let twIndex   = 0;
  let twTimeout = null;
  let twRunning = false;

  const originalPlaceholder = input.placeholder;


  // ── TYPEWRITER ─────────────────────────────────────────────────────────────

  function typewriterType(word, charIndex) {
    if (!twRunning) return;
    input.placeholder = word.slice(0, charIndex + 1);

    if (charIndex < word.length - 1) {
      twTimeout = setTimeout(function () {
        typewriterType(word, charIndex + 1);
      }, TYPEWRITER.speed);
    } else {
      twTimeout = setTimeout(function () {
        typewriterDelete(word, word.length - 1);
      }, TYPEWRITER.pauseAfter);
    }
  }

  function typewriterDelete(word, charIndex) {
    if (!twRunning) return;
    input.placeholder = word.slice(0, charIndex);

    if (charIndex > 0) {
      twTimeout = setTimeout(function () {
        typewriterDelete(word, charIndex - 1);
      }, TYPEWRITER.deleteSpeed);
    } else {
      twIndex   = (twIndex + 1) % SUGGESTIONS.length;
      twTimeout = setTimeout(function () {
        typewriterType(SUGGESTIONS[twIndex], 0);
      }, TYPEWRITER.pauseBefore);
    }
  }

  function typewriterStart() {
    if (twRunning || input.value.length > 0) return;
    twRunning = true;
    twTimeout = setTimeout(function () {
      typewriterType(SUGGESTIONS[twIndex], 0);
    }, TYPEWRITER.pauseBefore);
  }

  function typewriterStop() {
    twRunning = false;
    clearTimeout(twTimeout);
    input.placeholder = originalPlaceholder;
  }


  // ── LIFECYCLE ──────────────────────────────────────────────────────────────

  // Start on page load
  typewriterStart();

  // Pause when user focuses — restore placeholder if they tab away empty
  input.addEventListener('focus', typewriterStop);

  input.addEventListener('blur', function () {
    if (input.value.length === 0) {
      typewriterStart();
    }
  });

})();