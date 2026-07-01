/**
 * Sticky Header Behavior
 * File: assets/sticky-header.js
 */

(function () {
  'use strict';

  var header = document.getElementById('main-header');
  var stickyHamburger = document.querySelector('.sticky-header__hamburger');
  var menuBar = document.querySelector('.menu-bar');

  /* Only run if sticky header is enabled */
  if (!header || !header.classList.contains('main-header--sticky-enabled')) return;

  /* Scroll handler */
  function handleScroll() {
    if (window.scrollY > 60) {
      header.classList.add('is-sticky');
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-sticky');
      header.classList.remove('is-scrolled');

      if (menuBar) menuBar.classList.remove('is-visible');
      if (stickyHamburger) stickyHamburger.classList.remove('is-active');
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  /* Hamburger toggle */
  if (stickyHamburger && menuBar) {
    stickyHamburger.addEventListener('click', function () {
      var isOpen = menuBar.classList.toggle('is-visible');
      stickyHamburger.classList.toggle('is-active', isOpen);
    });
  }
})();