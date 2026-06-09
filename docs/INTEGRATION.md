# ECOMBIO Cart Drawer — Integration Instructions & Testing Checklist

---

## Architecture Overview

```
sections/header.liquid
├── snippets/ecombio-header-icons.liquid
│   └── snippets/ecombio-header-icon-cart.liquid   ← trigger only (button, badge)
└── snippets/ecombio-cart-drawer.liquid             ← NEW: drawer markup, owned here

assets/
├── ecombio-cart-drawer.css     ← NEW: all drawer styles
├── ecombio-cart.js             ← NEW: drawer open/close, AJAX cart ops
└── ecombio-cart-upsells.js    ← NEW: recommendations + add-to-cart intercept
```

The cart drawer is **owned by the Header Section** and rendered once at the
section level. It is not rendered from `ecombio-header-icons.liquid` or
`ecombio-header-icon-cart.liquid`, which remain leaf components.

---

## File Destinations

| Deliverable file                       | Copy to (in your Shopify theme)               |
|----------------------------------------|-----------------------------------------------|
| `header.liquid`                        | `sections/header.liquid` (replace)            |
| `ecombio-header-icon-cart.liquid`      | `snippets/ecombio-header-icon-cart.liquid` (replace) |
| `ecombio-cart-drawer.liquid`           | `snippets/ecombio-cart-drawer.liquid` (new)   |
| `ecombio-cart-drawer.css`             | `assets/ecombio-cart-drawer.css` (new)        |
| `ecombio-cart.js`                      | `assets/ecombio-cart.js` (new)                |
| `ecombio-cart-upsells.js`             | `assets/ecombio-cart-upsells.js` (new)        |

---

## Asset Loading

Add the following to your `layout/theme.liquid`, inside `<head>` for CSS and
before `</body>` for JS:

```liquid
{{ 'ecombio-cart-drawer.css' | asset_url | stylesheet_tag }}
```

```liquid
<script src="{{ 'ecombio-cart.js' | asset_url }}" defer></script>
<script src="{{ 'ecombio-cart-upsells.js' | asset_url }}" defer></script>
```

**Load order matters:** `ecombio-cart.js` must load before `ecombio-cart-upsells.js`
because the upsells module depends on `window.EcombioCart`.

---

## Theme Customizer Settings

After uploading `header.liquid`, the Header section in Theme Customizer will
expose the following new settings:

### Cart Drawer
- **Enable Cart Drawer** — toggles the entire system (default: on)

### Free Shipping Bar
- **Enable Free Shipping Progress Bar** — shows/hides the bar (default: on)
- **Free shipping minimum ($)** — dollar threshold (default: 75)

### Upsells & Recommendations
- **Enable Cart Upsells** — shows the frequently-bought-together row (default: on)
- **Enable Cart Recommendations** — reserved for future API use (default: on)
- **Enable AI Recommendations (future)** — placeholder, no-op for now (default: off)

### Pre-Checkout Upsell Page
- **Enable Pre-Checkout Upsell Page** — routes checkout button to `/pages/cart-upsell`
  instead of directly to Shopify Checkout (default: on)

---

## Pre-Checkout Upsell Page

The checkout button in the drawer routes to `/pages/cart-upsell` by default.
You must create this page in your Shopify admin:

1. **Admin → Online Store → Pages → Add page**
2. Set the handle to `cart-upsell`
3. Assign it a custom template (`page.cart-upsell.liquid`)

Prepare `templates/page.cart-upsell.liquid` with:
- Cart summary (current items + subtotal)
- Recommended add-ons / bundles / warranty / subscription offers
- "Accept Offer & Continue" button → `/cart/add.js` then redirect to checkout
- "Skip & Continue to Checkout" button → `{{ routes.checkout_url }}`

This is Stage 2 of the checkout funnel as specified in the PRD.

---

## AJAX Cart Integration for Product Pages

`ecombio-cart-upsells.js` automatically intercepts any form with
`action="/cart/add"`. No changes to product-page Liquid are needed.

If your product forms use a custom JS submit handler instead of native form
submission, dispatch this event after a successful add:

```javascript
document.dispatchEvent(new CustomEvent('ecombio:cart:added'));
```

This will cause the cart to refresh and the drawer to open.

---

## Analytics

All events are dispatched as `CustomEvent('ecombio:analytics')` on `document`.
Listen to integrate with GTM, Klaviyo, GA4, or any analytics provider:

```javascript
document.addEventListener('ecombio:analytics', function (e) {
  var event = e.detail.event;   // string
  var data  = e.detail;         // full payload

  // GTM example:
  if (window.dataLayer) window.dataLayer.push({ event: 'ecombio_' + event, ...data });
});
```

Events emitted:
| Event name                    | Payload fields                                  |
|-------------------------------|-------------------------------------------------|
| `cart_drawer_open`            | —                                               |
| `cart_drawer_close`           | —                                               |
| `cart_drawer_checkout_click`  | —                                               |
| `upsell_viewed`               | `product_ids: []`                               |
| `upsell_added`                | `variant_id`, `product_id`                      |

To track `checkout_started`, fire it on the `/pages/cart-upsell` page when the
user clicks "Proceed to Shopify Checkout".

---

## Testing Checklist

### Drawer Open / Close
- [ ] Clicking the cart icon opens the drawer
- [ ] Clicking the overlay closes the drawer
- [ ] Clicking the × button closes the drawer
- [ ] Clicking "Continue Shopping" closes the drawer
- [ ] Pressing Escape closes the drawer
- [ ] Focus returns to the cart icon button after closing

### Accessibility
- [ ] Tab key cycles through all interactive elements inside the drawer
- [ ] Focus does not escape the drawer while it is open (focus trap)
- [ ] Cart icon `aria-label` updates with correct item count
- [ ] Screen reader announces badge count changes (`aria-live`)
- [ ] Progress bar has `role="progressbar"` and correct `aria-valuenow`

### Cart Operations (no page reload)
- [ ] Increasing qty → item price, subtotal, badge update
- [ ] Decreasing qty → same
- [ ] Setting qty to 0 via input → item removed
- [ ] Clicking Remove → item removed, empty state shown if last item
- [ ] Savings row appears only when discounts apply

### Free Shipping Bar
- [ ] Bar fills proportionally to subtotal
- [ ] Message text updates as subtotal changes
- [ ] "You've unlocked free shipping!" shown at threshold
- [ ] Shipping note in summary updates accordingly

### Upsells
- [ ] Skeleton loaders shown while fetching
- [ ] Recommendation cards render with image, title, price
- [ ] "Add to Cart" on a card adds the item and refreshes drawer
- [ ] Button shows "✓ Added" and disables after successful add
- [ ] Upsell section hidden when cart is empty

### Auto-Open
- [ ] Adding a product via a standard product form opens the drawer
- [ ] Drawer shows the newly added item

### Checkout Routing
- [ ] "Continue to Checkout" links to `/pages/cart-upsell` (when setting enabled)
- [ ] "Continue to Checkout" links to `{{ routes.checkout_url }}` (when setting disabled)

### Responsive
- [ ] Drawer is full-width on mobile (< 600px)
- [ ] Drawer is 420px on tablet + desktop
- [ ] Touch scrolling works in item list and upsell track
- [ ] Upsell track scrolls horizontally on overflow

### Theme Customizer
- [ ] Toggling "Enable Cart Drawer" shows/hides the drawer
- [ ] Changing free shipping threshold updates the bar live (after save + reload)
- [ ] Toggling upsells shows/hides the recommendations section
