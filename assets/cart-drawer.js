/**
 * ecombio-cart-drawer.js
 * Handles open/close, quantity updates, item removal, and subtotal refresh
 * via Shopify Cart AJAX API (/cart/change.js, /cart/get.js)
 */

(() => {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const DRAWER_ID       = 'ecombio-cart-drawer';
  const OPEN_CLASS      = 'is-open';
  const LOADING_CLASS   = 'is-loading';
  const LOCK_CLASS      = 'cart-drawer-open';

  const TRIGGER_SEL     = '[data-ecombio-cart-trigger]';
  const CLOSE_SEL       = '[data-ecombio-cart-close]';
  const QTY_SEL         = '[data-ecombio-qty-change]';
  const REMOVE_SEL      = '[data-ecombio-remove-item]';
  const BODY_SEL        = '[data-ecombio-cart-body]';
  const FOOTER_SEL      = '[data-ecombio-cart-footer]';
  const SUBTOTAL_SEL    = '[data-ecombio-cart-subtotal]';
  const COUNT_SEL       = '[data-ecombio-cart-count]';
  const LOADING_SEL     = '[data-ecombio-cart-loading]';

  // ── State ──────────────────────────────────────────────────────────────────
  let lastTrigger = null;

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  function getDrawer() {
    return document.getElementById(DRAWER_ID);
  }

  function isOpen() {
    return getDrawer()?.classList.contains(OPEN_CLASS) ?? false;
  }

  function openDrawer() {
    const drawer = getDrawer();
    if (!drawer) return;

    drawer.removeAttribute('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add(OPEN_CLASS);
    document.documentElement.classList.add(LOCK_CLASS);

    // Move focus to first focusable child
    requestAnimationFrame(() => {
      const focusable = drawer.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length) focusable[0].focus();
    });
  }

  function closeDrawer() {
    const drawer = getDrawer();
    if (!drawer) return;

    drawer.setAttribute('hidden', '');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.classList.remove(OPEN_CLASS);
    document.documentElement.classList.remove(LOCK_CLASS);

    if (lastTrigger) lastTrigger.focus();
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  function setLoading(on) {
    const drawer  = getDrawer();
    const overlay = drawer?.querySelector(LOADING_SEL);
    if (!drawer || !overlay) return;

    if (on) {
      overlay.removeAttribute('hidden');
      overlay.setAttribute('aria-hidden', 'false');
      drawer.classList.add(LOADING_CLASS);
    } else {
      overlay.setAttribute('hidden', '');
      overlay.setAttribute('aria-hidden', 'true');
      drawer.classList.remove(LOADING_CLASS);
    }
  }

  // ── Cart AJAX ──────────────────────────────────────────────────────────────
  async function cartChange(key, quantity) {
    setLoading(true);
    try {
      const res = await fetch('/cart/change.js', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: key, quantity }),
      });
      if (!res.ok) throw new Error('Cart update failed');
      const cart = await res.json();
      await refreshDrawerHTML();
      updateBadges(cart.item_count, cart.total_price);
    } catch (err) {
      console.error('[EcombioCart]', err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshDrawerHTML() {
    try {
      const res = await fetch('/?section_id=cart-drawer', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) return;
      const text = await res.text();
      const doc  = new DOMParser().parseFromString(text, 'text/html');

      // Swap the body
      const newBody   = doc.querySelector(BODY_SEL);
      const curBody   = document.querySelector(BODY_SEL);
      if (newBody && curBody) curBody.innerHTML = newBody.innerHTML;

      // Swap the footer
      const newFooter = doc.querySelector(FOOTER_SEL);
      const curFooter = document.querySelector(FOOTER_SEL);
      if (newFooter && curFooter) {
        curFooter.innerHTML = newFooter.innerHTML;
        if (newFooter.hasAttribute('hidden')) {
          curFooter.setAttribute('hidden', '');
        } else {
          curFooter.removeAttribute('hidden');
        }
      }
    } catch (err) {
      console.error('[EcombioCart] HTML refresh failed', err);
    }
  }

  function updateBadges(itemCount, totalPrice) {
    // Update all cart count badges across the page
    document.querySelectorAll(COUNT_SEL).forEach((el) => {
      const isParens = el.textContent.trim().startsWith('(');
      el.textContent = isParens ? `(${itemCount})` : itemCount;
      el.setAttribute('aria-label', `${itemCount} item${itemCount !== 1 ? 's' : ''} in cart`);
    });

    // Update subtotal if present
    document.querySelectorAll(SUBTOTAL_SEL).forEach((el) => {
      // Format as Shopify money (cents → dollars) — adjust locale as needed
      el.textContent = formatMoney(totalPrice);
    });
  }

  function formatMoney(cents) {
    const amount = (cents / 100).toFixed(2);
    const symbol = window.Shopify?.currency?.symbol ?? '$';
    return `${symbol}${amount}`;
  }

  // ── Event delegation ───────────────────────────────────────────────────────
  document.body.addEventListener('click', (e) => {
    // Open trigger
    const trigger = e.target.closest(TRIGGER_SEL);
    if (trigger) {
      lastTrigger = trigger;
      isOpen() ? closeDrawer() : openDrawer();
      return;
    }

    // Close trigger (backdrop, close button, continue-shopping)
    if (e.target.closest(CLOSE_SEL)) {
      closeDrawer();
      return;
    }

    // Quantity stepper
    const qtyBtn = e.target.closest(QTY_SEL);
    if (qtyBtn) {
      const key      = qtyBtn.dataset.key;
      const delta    = parseInt(qtyBtn.dataset.delta, 10);
      const valueEl  = document.querySelector(`[data-qty-value="${key}"]`);
      const current  = valueEl ? parseInt(valueEl.textContent, 10) : 1;
      const newQty   = Math.max(0, current + delta);
      cartChange(key, newQty);
      return;
    }

    // Remove item
    const removeBtn = e.target.closest(REMOVE_SEL);
    if (removeBtn) {
      cartChange(removeBtn.dataset.key, 0);
      return;
    }

    // Backdrop: click outside inner panel while drawer is open
    const drawer = getDrawer();
    if (drawer && isOpen()) {
      const inner = drawer.querySelector('.ecombio-cart-drawer__inner');
      if (inner && !inner.contains(e.target)) {
        closeDrawer();
      }
    }
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) closeDrawer();
  });

  // Focus trap inside open drawer
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !isOpen()) return;
    const drawer   = getDrawer();
    const focusable = Array.from(drawer.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusable.length) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // ── Cart event bridge (fired by product-card.js after ATC) ───────────────
  document.addEventListener('cart:open', openDrawer);

  document.addEventListener('cart:updated', async () => {
    await refreshDrawerHTML();
    try {
      const res  = await fetch('/cart.js');
      const cart = await res.json();
      updateBadges(cart.item_count, cart.total_price);
    } catch (err) {
      console.error('[EcombioCart] badge refresh failed', err);
    }
  });

  // ── Public API ─────────────────────────────────────────────────────────────
  // Lets other scripts (e.g. add-to-cart) trigger the drawer
  window.EcombioCart = {
    open:   openDrawer,
    close:  closeDrawer,
    toggle: () => (isOpen() ? closeDrawer() : openDrawer()),
    refresh: refreshDrawerHTML,
  };

})();