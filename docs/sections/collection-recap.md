# Collection Section — Full Recap

## Files

| File | Location |
|---|---|
| `collection.liquid` | `sections/` |
| `collection-filters.liquid` | `snippets/` |
| `collection-compare-bar.liquid` | `snippets/` |
| `card-product.liquid` | `snippets/` |
| `collection.css` | `assets/` |
| `collection.js` | `assets/` |

---

## `collection.liquid`

- Loads `collection.css` and `collection.js` via asset tags
- Schema settings: `show_title` (checkbox), `show_filters` (checkbox), `products_per_page` (range 4–48, default 20)
- **`collection-sticky-bar`** div wraps three things and is `position: sticky; top: 0; z-index: 100`:
  1. **Toolbar** — filter button (only rendered if `show_filters`) + product count + sort select
  2. **Active filter pills bar** — `#active-filters-bar`, populated by JS
  3. **Compare bar** — `{% render 'collection-compare-bar' %}`, hidden by default, shown by compare JS
- `#filters-backdrop` div sits outside the sticky bar, used for mobile drawer overlay
- Layout is `collection-layout` flex row: sidebar left, `collection-main` right
- Sidebar rendered via `{% render 'collection-filters', open: true %}` — `open: true` makes it visible on desktop by default
- Filter button `aria-expanded="true"` on page load to match sidebar-open default state
- Grid inside `{% paginate collection.products by per_page %}`, with `{% else %}` empty state
- Pagination only renders when `paginate.pages > 1`

---

## `collection-filters.liquid`

- Parameters: `open` (Boolean) — adds `sidebar-open` class to `<aside>` for desktop default-open state
- Root element: `<aside class="collection-filters{% if open %} sidebar-open{% endif %}" id="collection-filters">`
- **No backdrop div** — that lives in `collection.liquid`
- Header: "Filters" heading + "Clear all" button (`#filters-clear-all`)
- Close `×` button for mobile drawer is **injected by JS**, not hardcoded
- **Availability** — single checkbox, `data-filter-type="availability"`, writes `filter.p.available=true` to URL
- **Price** — min/max number inputs with `data-filter-type="price-min/max"`, Apply button with `data-filter-price-apply`, writes `filter.v.price.gte` / `filter.v.price.lte` in cents
- **Tags** — auto-grouped by `_` separator (e.g. `Color_Red` → "Color" group, label "Red"); ungrouped tags fall into "Other"
- Each group is a collapsible accordion (`aria-expanded="true"` by default, `hidden` toggled by JS)

---

## `collection-compare-bar.liquid`

- Renders the `<compare-bar>` custom element
- Visibility controlled entirely by the compare bar's own JS via `.is-active` class — no Liquid logic
- Contains: counter (`0/5`), Compare button (disabled until items selected), toggle-list button (mobile), Clear all buttons (desktop + mobile versions), 5 placeholder `<li>` items
- CSS: `display: none` by default → `display: block` when `.is-active`

---

## `card-product.liquid`

- Props: `product`, `show_vendor` (default false), `show_compare_at_price` (default true)
- Renders `product.featured_image` as `card-product__image--primary`
- Renders `product.images[1]` as `card-product__image--secondary` if it exists — shown on hover via CSS opacity swap
- Sale price logic: if `compare_at_price > price`, shows sale price in red + compare price struck through
- No JS, pure Liquid + CSS

---

## `collection.css`

### Breakpoints

| Breakpoint | Range | What changes |
|---|---|---|
| Desktop | ≥1024px | sidebar sticky, grid 3 cols, toolbar normal layout |
| Desktop wide | ≥1400px | grid 4 cols |
| Tablet/mobile | ≤1023px | sidebar becomes drawer, toolbar sticky split bar |
| Mobile | ≤599px | grid 2 cols, tighter padding |
| Small mobile | ≤379px | grid 1 col |

### Sticky bar
- `position: sticky; top: 0; z-index: 100; background: #fff; border-bottom: 1px solid #e5e5e5`
- Contains toolbar + active pills + compare bar

### Toolbar (≤1023px)
- Sticky `top: 0`, `z-index: 100`, splits into two equal halves `[ ≡ Filters | Sort ▾ ]` divided by a hairline, flat/flush. Product count hidden.

### Sidebar — desktop (≥1024px)
- `width: 0; overflow: hidden` by default → `width: 240px; overflow: visible` when `.sidebar-open`
- Animated via `transition: width 0.25s ease`
- `position: sticky; top: 1.5rem; max-height: calc(100vh - 3rem); overflow-y: auto`

### Sidebar — tablet/mobile (≤1023px)
- `position: fixed`, slides in from left as a drawer via `transform: translateX(-100%)` → `translateX(0)` on `.is-open`
- Width `min(320px, 85vw)`, backdrop overlay with fade, body scroll locked while open

### Compare bar
- `display: none` → `display: block` on `.is-active`
- Flex layout, horizontal scroll for item list on mobile

### Product card
- No hover effects on card itself — only the photo flip (primary → secondary image via opacity transition)
- Image ratio: 4:3 (`padding-top: 75%`), `object-fit: cover`
- All colors use plain hex values — no CSS custom properties

---

## `collection.js`

All vanilla JS, no dependencies, single IIFE.

| Function | What it does |
|---|---|
| `initAccordions` | Toggles `aria-expanded` + `hidden` on filter group bodies |
| `initTagFilters` | Syncs checkboxes to URL tag path `/collections/{handle}/tag1+tag2` on load and change |
| `initAvailabilityFilter` | Checkbox writes/removes `filter.p.available=true` query param |
| `initPriceFilter` | Apply button (or Enter key) writes `filter.v.price.gte` / `filter.v.price.lte` in cents |
| `initClearAll` | Strips tag path + filter params, preserves `sort_by` |
| `buildPills` | Builds active filter pills from URL state on every load; each pill removes its own filter |
| `initSort` | Writes `sort_by` param and navigates; strips `page` param |
| `initFilterBtn` | **Single handler** for `#filters-open-btn`: mobile (≤1023px) → opens drawer with backdrop + body scroll lock; desktop (≥1024px) → toggles `.sidebar-open` on `#collection-filters`. Also injects mobile close `×` button into sidebar DOM. |

---

## Notes

- Shopify storefront filtering (`filter.p.*` / `filter.v.*`) must be **enabled in the theme** under Online Store → Themes → Customize → Collection pages → "Enable filtering". Without it, only tag-path filtering works.
- `top` values on sticky bar/sidebar assume **no sticky theme header**. If the theme has one, adjust `top` to match its height (e.g. `top: 60px`).
- The close button for the mobile drawer is injected by JS — if JS fails, the drawer can be opened but not closed.
- `card-product__image--secondary` only renders if `product.images[1]` exists — no layout breakage for single-image products.
- The sidebar starts **open by default** on desktop — `open: true` is passed from `collection.liquid` to `collection-filters.liquid`, which adds `sidebar-open` to the `<aside>` server-side. The filter button starts with `aria-expanded="true"` to match.
