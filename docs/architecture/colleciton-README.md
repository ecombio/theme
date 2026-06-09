# HYPER Theme — Collection Page Code

Matches the HYPER theme collection page layout exactly:
sidebar filters, toolbar, product grid with badges, color swatches, and pagination.

---

## Files included

| File | Destination in theme |
|------|---------------------|
| `templates/collection.json` | `templates/collection.json` |
| `sections/main-collection-product-grid.liquid` | `sections/main-collection-product-grid.liquid` |
| `snippets/filter-sidebar.liquid` | `snippets/filter-sidebar.liquid` |
| `snippets/sort-filter-bar.liquid` | `snippets/sort-filter-bar.liquid` |
| `snippets/product-card.liquid` | `snippets/product-card.liquid` |
| `assets/section-collection-product-grid.css` | `assets/section-collection-product-grid.css` |
| `assets/collection-filters.js` | `assets/collection-filters.js` |

---

## Installation steps

### 1. Upload files
In Shopify Admin → Online Store → Themes → **Edit code**, upload or paste each file into the matching folder.

### 2. Load CSS + JS in the section
The section file already includes:
```liquid
{{ 'section-collection-product-grid.css' | asset_url | stylesheet_tag }}
```
Add the JS before `</body>` in `layout/theme.liquid`:
```liquid
{{ 'collection-filters.js' | asset_url | script_tag }}
```

### 3. Enable filtering
- Install the **Shopify Search & Discovery** app (free, from Shopify).
- Go to Apps → Search & Discovery → Filters → add Availability, Price, Color, Category.
- In Theme Editor → Collections → Default collection → Product grid → check **Enable filtering**.

### 4. Color swatches
Color names in product variants must match CSS color names or hex values.
For custom colors, add a `color-swatch-config.json` to `assets/` mapping names to hex:
```json
{
  "Light Beige": "#d8cbb5",
  "Navy Blue": "#1e3a5f",
  "Charcoal": "#555555"
}
```
Then reference it in `product-card.liquid` via a metafield or snippet lookup.

### 5. Product badges
Badges are driven by product tags:
- `badge:new` → green "New" badge
- `badge:best-choice` → black "Best Choice!" badge
- `badge:coming-soon` → purple "Coming Soon" badge
- Sale badge is automatic when `compare_at_price > price`.

Selling Fast ticker: add metafield `foxtheme.selling_fast = true` on the product.

### 6. Image card (promo block)
In the Theme Editor, inside the Product grid section, click **Add block → Image card**.
- Set **Image position** (e.g. 1 = before first product)
- Upload a promo image
- Add heading, subheading, button label + link

### 7. Pagination options
In Theme Editor → Product grid settings → Pagination:
- **Pagination by number** — numbered pages (default)
- **Load more button** — "Show More" button
- **Infinite scroll** — auto-loads as user scrolls

---

## Key schema settings (Theme Editor)

| Setting | Default | Notes |
|---------|---------|-------|
| Products per page | 20 | 8–36 |
| Columns (desktop) | 4 | 1–6 |
| Columns (mobile) | 2 | 1–2 |
| Desktop filter layout | Vertical | Vertical or Drawer |
| Expand filter groups | `Availability, Price, Color` | Comma-separated |
| Enable color swatches | true | |
| Enable layout switching | true | Grid / List toggle |
| Enable compare | true | |
