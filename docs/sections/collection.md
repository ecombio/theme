Here's the full recap:

---

## Collection Section — Full Recap

### Files
| File | Location |
|---|---|
| `collection.liquid` | `sections/` |
| `collection-filters.liquid` | `snippets/` |
| `card-product.liquid` | `snippets/` |
| `collection.css` | `assets/` |
| `collection.js` | `assets/` |

---

### `collection.liquid`
- Loads `collection.css` and `collection.js` via asset tags
- Schema settings: `show_title` (checkbox), `show_filters` (checkbox), `products_per_page` (range 4–48, default 20)
- Renders a **toolbar** (filter button + product count + sort select) above the layout
- Renders an **active filter pills bar** below toolbar
- Layout is `collection-layout` flex row: sidebar left, `collection-main` right
- Sidebar rendered via `{% render 'collection-filters' %}` — conditionally shown via `show_filters`
- Grid inside `{% paginate collection.products by per_page %}`, with `{% else %}` empty state
- Pagination only renders when `paginate.pages > 1`

---

### `collection-filters.liquid`
- Standalone snippet, no props needed
- **Availability** — single checkbox, writes `filter.p.available=true` to URL
- **Price** — min/max number inputs, Apply button, writes `filter.v.price.gte` / `filter.v.price.lte` (in cents)
- **Tags** — auto-grouped: tags with `_` separator (e.g. `Color_Red`) group under the prefix; ungrouped tags fall into "Other"
- Each group is a collapsible accordion (`aria-expanded`, `hidden`)
- Header has "Filters" heading + "Clear all" button
- Injects a close `×` button (for mobile drawer) via JS, not hardcoded

---

### `card-product.liquid`
- Props: `product`, `show_vendor` (default false), `show_compare_at_price` (default true)
- Renders `product.featured_image` as `card-product__image--primary`
- Renders `product.images[1]` as `card-product__image--secondary` if it exists — shown on hover via CSS opacity swap
- Sale price logic: if `compare_at_price > price`, shows sale price in red + compare price struck through
- No JS, pure Liquid + CSS

---

### `collection.css`

**Breakpoint system:**
| Breakpoint | Range | What changes |
|---|---|---|
| Desktop | ≥1024px | sidebar sticky, grid 3 cols, toolbar normal |
| Desktop wide | ≥1400px | grid 4 cols |
| Tablet/mobile | ≤1023px | sidebar becomes drawer, toolbar sticky + split bar |
| Mobile | ≤599px | grid 2 cols, tighter padding |
| Small mobile | ≤379px | grid 1 col |

**Toolbar (≤1023px):** sticky `top: 0`, `z-index: 100`, splits into two equal halves — `[ ≡ Filters | Sort ▾ ]` — divided by a hairline, flat/flush, no box borders. Product count hidden.

**Sidebar desktop:** `position: sticky`, `top: 1.5rem`, `max-height: calc(100vh - 3rem)`, `overflow-y: auto` — scrolls independently if filter list is long.

**Sidebar tablet/mobile:** `position: fixed`, slides in from left as a drawer, backdrop overlay with fade, body scroll locked while open. Width `min(320px, 85vw)`.

**Product card:** no hover effects on the card itself — no lift, no shadow change, no scale. Only effect is the photo flip (primary → secondary image via `opacity` transition on the image wrapper hover).

**Image ratio:** 4:3 (`padding-top: 75%`), `object-fit: cover`.

---

### `collection.js`
All vanilla JS, no dependencies, wrapped in an IIFE.

- **Accordions** — toggle `aria-expanded` + `hidden` on filter groups
- **Tag filters** — syncs to Shopify tag URL path: `/collections/{handle}/tag1+tag2`. Reads active tags from the URL path on load to check the right boxes
- **Availability** — checkbox writes/removes `filter.p.available=true` query param
- **Price** — Apply button (or Enter key) writes `filter.v.price.gte` / `filter.v.price.lte` in cents
- **Clear all** — strips tag path and filter params, preserves `sort_by`
- **Active pills** — built dynamically from current URL state on every load; each pill has its own remove action; count badge on the filter button
- **Sort select** — writes `sort_by` param and navigates; page param stripped on any filter/sort change
- **Mobile drawer** — open/close the sidebar, backdrop click to dismiss, Escape key to close, body scroll lock. Close button injected into sidebar DOM on init. Breakpoint check at `1024px` matches CSS

---

### Notes for next time
- Shopify storefront filtering (`filter.p.*` / `filter.v.*`) must be **enabled in the theme** under Online Store → Themes → Customize → Collection pages → "Enable filtering". Without it, only tag-path filtering works
- `top` value on sticky sidebar/toolbar assumes **no sticky header**. If the theme has one, adjust `top` to match its height (e.g. `top: 60px`)
- The close button for the mobile drawer is injected by JS — if JS fails, the drawer can still be opened but not closed (consider a noscript fallback if needed)
- `card-product__image--secondary` only renders if `product.images[1]` exists — no broken layout if product has only one image