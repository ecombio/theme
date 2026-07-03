/* ============================================================
   assets/header-menu.js
   Handles: sticky scroll, mobile drawer, search toggle,
            mobile accordion, trap focus

   NOTE: the old generic "[data-dropdown-item]" hover/click handler
   has been removed from this file. It was a second, competing
   open/close implementation that didn't match any markup currently
   rendered by sections/header-menu.liquid (link-list, mega, and
   flyout blocks each ship their own dedicated script —
   link-list.js, mega-menu.js, flyout.js — that already owns
   open/close, aria-expanded, keyboard nav, and outside-click for
   its own elements). If anything in the markup is ever given a
   data-dropdown-item attribute, this generic handler would race
   against that bespoke script for the same element. Remove for
   good, or reintroduce deliberately scoped to elements none of the
   per-block-type scripts already manage.
   ============================================================ */

(function () {
  'use strict';

  /* ── Selectors ────────────────────────────────────────────── */
  const header         = document.querySelector('[data-section-type="header-menu"]');
  if (!header) return; // section not on page

  const burger         = header.querySelector('[data-burger]');
  const drawer         = document.querySelector('[data-mobile-drawer]');
  const drawerOverlay  = drawer?.querySelector('[data-drawer-overlay]');
  const drawerClose    = drawer?.querySelector('[data-drawer-close]');
  const searchTrigger  = header.querySelector('[data-search-trigger]');
  const searchPanel    = header.querySelector('[data-search-panel]');
  const searchClose    = header.querySelector('[data-search-close]');
  const searchInput    = header.querySelector('.site-search__input');
  const mobileAccords  = drawer?.querySelectorAll('[data-mobile-accordion]');

  /* ── Sticky / scroll shadow ───────────────────────────────── */
  if (header.classList.contains('site-header--sticky')) {
    const onScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 4);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run once on load
  }

  /* ── Utility: trap focus inside an element ────────────────── */
  function trapFocus(container) {
    const focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return () => {};
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    const handler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };
    container.addEventListener('keydown', handler);
    first.focus();
    return () => container.removeEventListener('keydown', handler);
  }

  /* ── Mobile drawer ────────────────────────────────────────── */
  let releaseFocus = null;

  function openDrawer() {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    releaseFocus = trapFocus(drawer.querySelector('.mobile-drawer__panel'));
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (releaseFocus) { releaseFocus(); releaseFocus = null; }
    burger.focus();
  }

  burger?.addEventListener('click', () => {
    const isOpen = drawer.classList.contains('is-open');
    isOpen ? closeDrawer() : openDrawer();
  });
  drawerOverlay?.addEventListener('click', closeDrawer);
  drawerClose?.addEventListener('click', closeDrawer);

  drawer?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  /* ── Search toggle ────────────────────────────────────────── */
  function openSearch() {
    searchPanel.classList.add('is-open');
    searchPanel.setAttribute('aria-hidden', 'false');
    searchTrigger.setAttribute('aria-expanded', 'true');
    // Small delay so the max-height transition has started before focus
    setTimeout(() => searchInput?.focus(), 50);
  }

  function closeSearch() {
    searchPanel.classList.remove('is-open');
    searchPanel.setAttribute('aria-hidden', 'true');
    searchTrigger.setAttribute('aria-expanded', 'false');
    searchTrigger.focus();
  }

  searchTrigger?.addEventListener('click', () => {
    const isOpen = searchPanel.classList.contains('is-open');
    isOpen ? closeSearch() : openSearch();
  });
  searchClose?.addEventListener('click', closeSearch);

  header.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchPanel?.classList.contains('is-open')) closeSearch();
  });

  /* ── Mobile accordion ─────────────────────────────────────── */
  mobileAccords?.forEach((btn) => {
    const children = btn.nextElementSibling; // ul.mobile-nav__children
    if (!children) return;

    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isExpanded));
      children.hidden = isExpanded;
      const chevron = btn.querySelector('.nav-chevron');
      if (chevron) chevron.style.transform = isExpanded ? '' : 'rotate(180deg)';
    });
  });

  /* ── Announce cart updates (optional progressive enhancement) */
  // Shopify section events / AJAX cart – update badge without full reload
  document.addEventListener('cart:updated', (e) => {
    const count = e.detail?.cart?.item_count ?? 0;
    const cartLink = header.querySelector('[data-cart-link]');
    if (!cartLink) return;
    let badge = cartLink.querySelector('.cart-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        badge.setAttribute('aria-hidden', 'true');
        cartLink.appendChild(badge);
      }
      badge.textContent = count;
      cartLink.setAttribute('aria-label', `Cart (${count} item${count > 1 ? 's' : ''})`);
    } else {
      badge?.remove();
      cartLink.setAttribute('aria-label', 'Cart');
    }
  });

})();
