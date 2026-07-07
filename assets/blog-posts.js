// Blog Posts Section - JavaScript
document.addEventListener('DOMContentLoaded', function () {
  const filterBar = document.getElementById('tag-filter-bar');

  if (filterBar) {
    // Optional: Add subtle active state animation or future enhancements
    const pills = filterBar.querySelectorAll('.tag-pill');

    pills.forEach(pill => {
      pill.addEventListener('click', function (e) {
        // Multi-tag selection is handled server-side via ?tags=a,b,c
        // (native link behavior — fastest, no JS needed for filtering itself)
        // You can add loading state or analytics here later
      });
    });
  }

  // Future: You can expand this for AJAX filtering, tag search, etc.
  console.log('%c[Blog Posts] Section initialized', 'color:#888');
});