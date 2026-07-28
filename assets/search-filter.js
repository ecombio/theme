/* assets/search-filter.js */

(function () {
  'use strict';

  if (window.__searchFilterAccordionLoaded) return;
  window.__searchFilterAccordionLoaded = true;

  var filterPanel = document.getElementById('search-filter');
  if (!filterPanel) return;

  filterPanel.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-filter-group-toggle]');
    if (!toggle || !filterPanel.contains(toggle)) return;

    var expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));

    var body = document.getElementById(toggle.getAttribute('aria-controls'));
    if (body) body.hidden = expanded;
  });
})();