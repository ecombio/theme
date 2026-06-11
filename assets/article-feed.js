// article-feed.js — Barebone Article Feed with multi-tag filtering

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.article-feed').forEach(feed => {
    const toggle      = feed.querySelector('.article-feed__multiselect-toggle');
    const dropdown    = feed.querySelector('.article-feed__multiselect-dropdown');
    const placeholder = feed.querySelector('.article-feed__multiselect-placeholder');
    const activeTags  = feed.querySelector('.article-feed__active-tags');
    const cards       = feed.querySelectorAll('.article-feed__card');
    const emptyMsg    = feed.querySelector('.article-feed__empty');

    if (!toggle || !dropdown) {
      console.log('%c[Article Feed] Initialized (no filter)', 'color: #888');
      return;
    }

    // ── Open / close ──────────────────────────────────────────────────────────

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      dropdown.hidden = isOpen;
    });

    // Close when clicking outside
    document.addEventListener('click', e => {
      if (!feed.querySelector('.article-feed__multiselect').contains(e.target)) {
        toggle.setAttribute('aria-expanded', 'false');
        dropdown.hidden = true;
      }
    });

    // Close on Escape
    dropdown.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        toggle.setAttribute('aria-expanded', 'false');
        dropdown.hidden = true;
        toggle.focus();
      }
    });

    // ── Filter logic ──────────────────────────────────────────────────────────

    function getSelectedTags() {
      return [...feed.querySelectorAll('.article-feed__tag-checkbox:checked')]
        .map(cb => cb.value.toLowerCase());
    }

    function applyFilter() {
      const selected = getSelectedTags();

      // Update toggle label
      if (selected.length === 0) {
        placeholder.textContent = 'All topics';
      } else if (selected.length === 1) {
        placeholder.textContent = selected[0];
      } else {
        placeholder.textContent = `${selected.length} topics selected`;
      }

      // Update pill strip
      activeTags.innerHTML = selected
        .map(tag => `
          <button class="article-feed__active-tag" data-tag="${tag}" aria-label="Remove ${tag}">
            ${tag}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        `).join('');

      // Show/hide cards
      let visibleCount = 0;
      cards.forEach(card => {
        const cardTags = (card.dataset.tags || '')
          .split(',')
          .map(t => t.trim().toLowerCase())
          .filter(Boolean);

        const match = selected.length === 0 || selected.some(t => cardTags.includes(t));
        card.hidden = !match;
        if (match) visibleCount++;
      });

      if (emptyMsg) emptyMsg.hidden = visibleCount > 0;
    }

    // Checkbox change
    dropdown.addEventListener('change', e => {
      if (e.target.matches('.article-feed__tag-checkbox')) applyFilter();
    });

    // Remove pill
    activeTags.addEventListener('click', e => {
      const btn = e.target.closest('.article-feed__active-tag');
      if (!btn) return;
      const tag = btn.dataset.tag;
      const cb  = feed.querySelector(`.article-feed__tag-checkbox[value="${tag}"]`);
      if (cb) { cb.checked = false; applyFilter(); }
    });

    console.log('%c[Article Feed] Initialized with tag filter', 'color: #888');
  });
});