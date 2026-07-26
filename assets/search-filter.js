/* assets/search-filter.js
   Owned by snippets/search-filter.liquid, which loads this file
   directly via a <script src> tag right after the <aside>.

   2026-07-25 FIX: this file used to duplicate almost everything
   assets/main-search.js already does -- opening/closing the drawer,
   the mobile backdrop, live AJAX filtering (Section Rendering API),
   and the price slider/bracket sync. Both files bound independent
   click listeners to the SAME [data-filter-toggle] buttons, and this
   file had no re-entry guard at all (main-search.js's copy is gated
   behind window.__searchFilterLoaded), so both handlers fired on
   every click. That produced an open-then-immediately-close race
   depending on listener order, and -- combined with main-search.js's
   own live-filtering swap -- two independent fetches per filter
   change targeting two different (and in this file's case, unverified
   / guessed) sets of element ids. That's been removed here. Open/
   close, live filtering, and the price slider are now owned
   exclusively by assets/main-search.js.

   What's left in this file is the ONE piece of behavior main-search.js
   does not already provide: the filter-group accordion (chevron /
   aria-expanded toggle on each group header). It's delegated on the
   panel itself so it keeps working after main-search.js's
   applyFiltersLive() replaces the filter form's innerHTML -- no
   rebinding needed here when that happens.

   If you ever need to re-home the accordion into main-search.js
   instead (e.g. to fully retire this file), this IIFE can be deleted
   and its contents pasted in there unmodified -- it doesn't depend on
   anything else in this file.
*/

(function () {
  'use strict';

  if (window.__searchFilterAccordionLoaded) return;
  window.__searchFilterAccordionLoaded = true;

  var filterPanel = document.getElementById('search-filter');
  if (!filterPanel) return;

  /* ── Group accordion (chevron / aria-expanded) ───────────────
     Delegated on the panel itself, so it keeps working after
     main-search.js's applyFiltersLive() replaces the filter form's
     innerHTML -- no rebinding needed for this one. */
  filterPanel.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-filter-group-toggle]');
    if (!toggle || !filterPanel.contains(toggle)) return;

    var expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));

    var body = document.getElementById(toggle.getAttribute('aria-controls'));
    if (body) body.hidden = expanded;
  });
})();