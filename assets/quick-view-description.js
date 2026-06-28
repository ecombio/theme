// ══════════════════════════════════════════════════════════════════════════
// DESCRIPTION TABS  —  add to assets/quick-view.js
//
// Paste initDescriptionTabs() into the existing IIFE, then call it at the
// end of initVariantUI().
//
// If you call initVariantUI() and then initDescriptionTabs() separately
// from loadProduct() that also works fine — the [data-qv-desc-init] guard
// prevents double-binding either way.
// ══════════════════════════════════════════════════════════════════════════

function initDescriptionTabs() {
  const wrap = qs('[data-qv-desc-wrap]', body);
  if (!wrap || wrap.dataset.qvDescInit) return;
  wrap.dataset.qvDescInit = '1';

  const tabs   = qsa('[data-qv-tab]', wrap);
  const panels = qsa('[data-qv-tab-panel]', wrap);
  if (!tabs.length) return;

  // ── Activate tab at given index ────────────────────────────────────────
  function activateTab(index) {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.setAttribute('tabindex', active ? '0' : '-1');
    });

    panels.forEach((panel, i) => {
      const active = i === index;
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', String(!active));
    });
  }

  // Ensure correct initial tabindex (Liquid sets is-active on first tab)
  tabs.forEach((tab, i) => {
    const isActive = tab.classList.contains('is-active');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  // ── Click ──────────────────────────────────────────────────────────────
  wrap.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-qv-tab]');
    if (!tab) return;
    const index = tabs.indexOf(tab);
    if (index === -1) return;
    activateTab(index);
    tab.focus();
  });

  // ── Keyboard: roving tabindex (ARIA tabs pattern) ──────────────────────
  wrap.addEventListener('keydown', (e) => {
    const tab = e.target.closest('[data-qv-tab]');
    if (!tab) return;

    const current = tabs.indexOf(tab);
    let next = current;

    switch (e.key) {
      case 'ArrowRight': next = (current + 1) % tabs.length;                    break;
      case 'ArrowLeft':  next = (current - 1 + tabs.length) % tabs.length;      break;
      case 'Home':       next = 0;                                               break;
      case 'End':        next = tabs.length - 1;                                 break;
      default: return;
    }

    e.preventDefault();
    activateTab(next);
    tabs[next].focus();
  });
}

// ── Integration point ──────────────────────────────────────────────────────
// In your existing quick-view.js, find initVariantUI() and add ONE line
// at the very bottom of the function, just before the closing brace:
//
//   function initVariantUI() {
//     const wrap = qs('.quick-view', body);
//     // … all existing code …
//
//     initDescriptionTabs();   // ← ADD THIS LINE
//   }
