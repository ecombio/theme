// ECOMBIO Header - Categories Controller Toggle
document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.querySelector('.ecombio-header__cat-trigger');
  const dropdown = document.getElementById('ecombio-header-cat-dropdown');

  if (!trigger || !dropdown) return;

  trigger.addEventListener('click', () => {
    const isOpen = dropdown.hidden === false;
    dropdown.hidden = isOpen;
    trigger.setAttribute('aria-expanded', String(!isOpen));
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dropdown.hidden) {
      dropdown.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    }
  });
});