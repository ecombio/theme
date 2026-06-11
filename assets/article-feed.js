// article-feed.js — Barebone Article Feed

document.addEventListener('DOMContentLoaded', () => {
  const feeds = document.querySelectorAll('.article-feed');

  feeds.forEach(feed => {
    // Ready for future enhancements (lazy loading, load more, analytics, etc.)
    console.log('%c[Article Feed] Initialized', 'color: #888');
  });
});