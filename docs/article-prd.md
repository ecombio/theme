# PRD — Shopify Article (Blog Post) Template

## Overview

This document outlines what we have, what's incomplete, and what should be built next for the article template (`article.liquid`, `article.css`, `article.js`). The goal is a production-ready, content-first blog experience that serves both readers and the store's broader content strategy.

---

## Current State

### What's in place
- Three-column layout: sticky TOC (left) → article content (center) → recent posts (right)
- Hero banner with image, overlay gradient, blog eyebrow, title, and author/date meta
- Nav bar pulling from `linklists.main-menu`
- TOC built dynamically from `h2` headings via JS, with `IntersectionObserver` active state
- Comments section with Shopify's native comment form (gated behind `blog.comments_enabled?`)
- Responsive breakpoints: 2-col at 1024px, single-col at 680px

### Known gaps
- Right sidebar has only "Recent Posts" — no real utility beyond that
- No reading time estimate
- No article tags, author bio, or share actions surfaced anywhere in the layout
- No prev/next article navigation
- Banner falls back to a plain dark background when no article image is set — no placeholder strategy
- Schema has zero settings — nothing is customizable from the theme editor
- No structured data / SEO metadata (Open Graph, JSON-LD)
- Comments form has no spam protection or success/error feedback beyond Shopify's default errors

---

## Goals

1. Make the article feel complete and editorial, not a barebones Shopify default
2. Give merchants control over the layout through theme editor settings
3. Improve discoverability — readers should always have a clear next action
4. Lay the groundwork for SEO without over-engineering it

---

## Scope

### 1. Article Header / Banner

**What to build:**
- Reading time estimate (calculated from `article.content | strip_html | split: ' ' | size`) displayed alongside author and date in the banner meta line
- A fallback banner state when no article image exists — use a solid color or subtle pattern rather than plain `#1a1a1a`, ideally driven by a theme setting
- Schema setting: `banner_height` (compact / default / tall) controlling `min-height`

**Out of scope:** video banners, animated headers

---

### 2. Left Sidebar — TOC

**What to build:**
- Hide the TOC widget entirely on mobile (it collapses into the single-column flow awkwardly below the article, which isn't useful)
- Show a count of sections: e.g. "5 sections" as a subtitle under the widget title
- Smooth scroll offset to account for any sticky nav height (currently `scrollIntoView` doesn't account for the 60px nav bar, so headings land under it)

**Out of scope:** collapsible TOC, nested h3 entries (intentionally excluded per prior decision)

---

### 3. Article Content

**What to build:**
- Prose typography pass in CSS: comfortable `max-width` on `.article-content` prose (around `68ch`), consistent heading hierarchy styles, blockquote styling, inline code styling
- First paragraph lead treatment — slightly larger font size to ease readers in
- Image caption support: style `figcaption` elements within the article content
- Tags rendered inline at the bottom of the article content (before comments), as pill links back to `blog.url/tagged/{{ tag }}`

**Out of scope:** custom shortcodes, Metafield-driven content blocks (separate project)

---

### 4. Right Sidebar

**What to build:**
- Author widget: `article.author` name, and if a Metaobject for authors is set up, pull a short bio and avatar; otherwise gracefully omit
- Tags widget: render `article.tags` as pill links (mirrors what was removed from the left sidebar)
- Share widget: Twitter/X, Facebook, and copy-link — replace the removed share block from the left sidebar
- Schema setting to toggle each widget on/off individually

**What to consider:** the right sidebar disappears at 1024px in the current responsive layout, so anything critical (tags, share) should also appear at the bottom of `.article-content` on smaller screens as a fallback

---

### 5. Post Navigation

**What to build:**
- Prev / Next article links at the bottom of `.article-content`, above comments
- Use `blog.previous_article` and `blog.next_article` Liquid objects
- Display as a two-column row: previous on the left, next on the right, each showing the article title and published date
- Falls back gracefully if either doesn't exist (first or last post in the blog)

---

### 6. Comments

**What to build:**
- Success state: when `form.posted_successfully?` is true, show a confirmation message and hide the form
- Better form styling: current inputs are functional but plain — bring them in line with the rest of the design
- Honeypot or basic spam consideration (Shopify handles this natively via the `new_comment` form, but surface a note in the code)

**Out of scope:** threaded replies, upvotes, third-party comment systems (Disqus etc.)

---

### 7. SEO & Structured Data

**What to build:**
- `<meta>` Open Graph tags in the section head: `og:title`, `og:description` (from `article.excerpt`), `og:image` (from `article.image`), `og:type: article`
- JSON-LD `Article` schema block rendered in a `<script type="application/ld+json">` tag — author, datePublished, image, headline
- Canonical URL tag

**Note:** These should go into `article.liquid` directly since this is a section-level file, not the layout. Coordinate with whatever `<head>` the theme layout renders to avoid duplication.

---

### 8. Theme Editor Settings (Schema)

The current schema is empty. At minimum, expose:

| Setting | Type | Default |
|---|---|---|
| Show TOC | checkbox | true |
| Show right sidebar | checkbox | true |
| Banner height | select: compact / default / tall | default |
| Show comments | checkbox | follows `blog.comments_enabled?` |
| Show post navigation | checkbox | true |
| Show reading time | checkbox | true |

---

## File Structure (no changes proposed)

```
assets/
  article.css
  article.js
sections/
  article.liquid
```

All three files stay co-located and scoped. No new files needed for the above scope unless the author Metaobject integration warrants its own snippet (`snippets/article-author.liquid`).

---

## Prioritisation

| Priority | Item |
|---|---|
| P0 | Prose typography + `ch`-based content width |
| P0 | Prev / Next navigation |
| P0 | Scroll offset fix for TOC smooth scroll |
| P1 | Reading time estimate |
| P1 | Tags at bottom of article content |
| P1 | Right sidebar: share + tags widgets |
| P1 | Open Graph meta tags |
| P2 | Schema settings |
| P2 | JSON-LD structured data |
| P2 | Author widget (requires Metaobject setup) |
| P2 | Comments success state |
| P3 | Banner fallback treatment |
| P3 | TOC section count |
| P3 | Mobile TOC hide |
