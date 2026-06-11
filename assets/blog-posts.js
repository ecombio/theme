// Blog Posts Section - JavaScript
document.addEventListener('DOMContentLoaded', function () {
  const filterBar = document.getElementById('tag-filter-bar');

  if (filterBar) {
    // Optional: Add subtle active state animation or future enhancements
    const pills = filterBar.querySelectorAll('.tag-pill');

    pills.forEach(pill => {
      pill.addEventListener('click', function (e) {
        // You can add loading state or analytics here later
        // Currently using native link behavior (fastest)
      });
    });
  }

  // Future: You can expand this for AJAX filtering, tag search, etc.
  console.log('%c[Blog Posts] Section initialized', 'color:#888');
});