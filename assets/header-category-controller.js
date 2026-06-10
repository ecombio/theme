document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.ecombio-header__cat-toggle');
  const mobileNav = document.getElementById('ecombio-mobile-nav');

  if (!toggle || !mobileNav) return;

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';

    toggle.setAttribute('aria-expanded', !isOpen);
    mobileNav.setAttribute('aria-hidden', isOpen);

    // Optional: also toggle a class on body or nav for styling
    document.body.classList.toggle('nav-open', !isOpen);
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !mobileNav.contains(e.target)) {
      toggle.setAttribute('aria-expanded', 'false');
      mobileNav.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('nav-open');
    }
  });
});