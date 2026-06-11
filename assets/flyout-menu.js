/**
 * ECOMBIO Flyout Menu — Two-panel sidebar nav
 * File: assets/flyout-menu.js
 *
 * Behaviour:
 *   - Hovering a sidebar category swaps the right-hand content panel
 *     using hover-intent (100ms delay) to avoid accidental triggers
 *   - Keyboard: arrow keys navigate the sidebar; Enter/Space activates
 *   - Active state is tracked via CSS class + aria-current
 *   - Works with the mega-menu open/close system in header-mega-menu.js
 */

(function () {
  'use strict';

  const HOVER_DELAY = 100; // ms before panel swaps on hover

  class FlyoutMenu {
    constructor(el) {
      this.el = el;
      this.cats = Array.from(el.querySelectorAll('[data-flyout-target]'));
      this.sections = Array.from(el.querySelectorAll('.flyout-menu__section'));
      this._hoverTimer = null;

      this._bindEvents();
      // Ensure first item is active on init
      if (this.cats.length) this._activate(this.cats[0], false);
    }

    _bindEvents() {
      this.cats.forEach(cat => {
        cat.addEventListener('mouseenter', () => this._onEnter(cat));
        cat.addEventListener('mouseleave', () => this._onLeave());
        cat.addEventListener('focus',      () => this._activate(cat, false));
        cat.addEventListener('click',      e  => this._onClick(e, cat));
        cat.addEventListener('keydown',    e  => this._onKeydown(e, cat));
      });
    }

    _onEnter(cat) {
      clearTimeout(this._hoverTimer);
      this._hoverTimer = setTimeout(() => this._activate(cat, false), HOVER_DELAY);
    }

    _onLeave() {
      clearTimeout(this._hoverTimer);
    }

    _onClick(e, cat) {
      // If the category has children shown in the panel, prevent navigation
      // and just activate. If it has no children, allow the link to navigate.
      const targetId = cat.dataset.flyoutTarget;
      const section  = this.el.querySelector('#' + targetId);
      if (section) {
        e.preventDefault();
        this._activate(cat, false);
      }
    }

    _onKeydown(e, cat) {
      const idx = this.cats.indexOf(cat);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = this.cats[idx + 1];
        if (next) { next.focus(); this._activate(next, false); }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = this.cats[idx - 1];
        if (prev) { prev.focus(); this._activate(prev, false); }
      }
    }

    _activate(cat, navigate) {
      const targetId = cat.dataset.flyoutTarget;

      // Update sidebar items
      this.cats.forEach(c => {
        c.classList.toggle('flyout-menu__cat--active', c === cat);
        c.setAttribute('aria-current', c === cat ? 'true' : 'false');
      });

      // Swap content panels
      this.sections.forEach(sec => {
        const isTarget = sec.id === targetId;
        sec.classList.toggle('flyout-menu__section--visible', isTarget);
        sec.setAttribute('aria-hidden', isTarget ? 'false' : 'true');
      });

      if (navigate) {
        window.location.href = cat.href;
      }
    }
  }

  function init() {
    document.querySelectorAll('[data-flyout-menu]').forEach(el => {
      if (!el._flyoutMenu) el._flyoutMenu = new FlyoutMenu(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
