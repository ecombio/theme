/**
 * assets/blog-menu.js
 *
 * Merged from blog-menu.js (mobile toggle + dropdown behavior) and
 * blog-menu-sticky.js (sticky-on-scroll, coordinated with
 * header-group.js) — they were always two halves of the same nav's
 * behavior, no reason to ship them as separate requests.
 *
 * Sticky notes carried over from blog-menu-sticky.js: CSS
 * `position: sticky` only sticks within its own containing block.
 * Shopify wraps this section in its own content-sized
 * `.shopify-section` div, so the nav has almost no room to travel
 * before its own wrapper's bottom edge scrolls past and sticky
 * detaches. This swaps the nav to `position: fixed` (`.is-stuck`,
 * styled in blog-menu.css) once you scroll past its natural resting
 * position, so it stays visible for the rest of the page instead of
 * only within its own section. A spacer element reserves the nav's
 * height in the flow so nothing jumps when it goes fixed. It reads
 * --header-group-height and the header-group-hidden class already
 * maintained by header-group.js, so the two stay coordinated (menu
 * offset collapses to 0 when the header tucks away, matches when it
 * reappears).
 *
 * Scoped per-instance so multiple blog-menu sections can exist on one page.
 */
(function () {
  'use strict';

  function closeAllDropdowns(nav, exceptItem) {
    nav.querySelectorAll('[data-blog-menu-dropdown-toggle]').forEach(function (btn) {
      var item = btn.closest('.blog-menu__item--list');
      if (item === exceptItem) return;
      item.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function initToggleAndDropdowns(nav) {
    var toggle = nav.querySelector('[data-blog-menu-toggle]');
    var list = nav.querySelector('[data-blog-menu-list]');

    if (toggle && list) {
      toggle.addEventListener('click', function () {
        var isOpen = list.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    nav.querySelectorAll('[data-blog-menu-dropdown-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.stopPropagation();
        var item = btn.closest('.blog-menu__item--list');
        var willOpen = !item.classList.contains('is-open');
        closeAllDropdowns(nav, willOpen ? item : null);
        item.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
      });

      btn.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          var item = btn.closest('.blog-menu__item--list');
          item.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        }
      });
    });

    document.addEventListener('click', function (event) {
      if (!nav.contains(event.target)) {
        closeAllDropdowns(nav, null);
      }
    });
  }

  function initSticky(nav) {
    if (!nav.classList.contains('blog-menu--sticky')) return;

    var spacer = document.createElement('div');
    spacer.className = 'blog-menu__spacer';
    spacer.setAttribute('aria-hidden', 'true');
    nav.parentNode.insertBefore(spacer, nav.nextSibling);

    var originalTop = 0;
    var ticking = false;

    function getHeaderOffset() {
      var height =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--header-group-height')
        ) || 0;
      var hidden = document.documentElement.classList.contains('header-group-hidden');
      return hidden ? 0 : height;
    }

    function measure() {
      // Only re-measure the nav's natural offset while it's still in
      // normal flow, so switching to fixed doesn't corrupt the value.
      if (!nav.classList.contains('is-stuck')) {
        originalTop = nav.getBoundingClientRect().top + window.scrollY;
      }
      spacer.style.height = nav.offsetHeight + 'px';
    }

    function update() {
      var shouldStick = window.scrollY + getHeaderOffset() >= originalTop;

      if (shouldStick && !nav.classList.contains('is-stuck')) {
        nav.classList.add('is-stuck');
        spacer.classList.add('is-active');
      } else if (!shouldStick && nav.classList.contains('is-stuck')) {
        nav.classList.remove('is-stuck');
        spacer.classList.remove('is-active');
        measure(); // re-baseline originalTop now that it's back in flow
      }
      ticking = false;
    }

    measure();
    update();

    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'resize',
      function () {
        measure();
        update();
      },
      { passive: true }
    );

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        measure();
      }).observe(nav);
    }

    // Recalculate immediately when header-group.js toggles hide/show,
    // rather than waiting for the next scroll tick.
    var rootObserver = new MutationObserver(update);
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  function initMenu(nav) {
    initToggleAndDropdowns(nav);
    initSticky(nav);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-blog-menu]').forEach(initMenu);
  });

  // Re-init inside the theme editor when the section is added/re-rendered.
  document.addEventListener('shopify:section:load', function (event) {
    var nav = event.target.querySelector('[data-blog-menu]');
    if (nav) initMenu(nav);
  });
})();