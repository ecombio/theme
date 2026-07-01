/**
 * Sticky Header
 * File: assets/sticky-header.js
 */

(function () {
  'use strict';

  var header = document.getElementById('main-header');
  var stickyHamburger = document.querySelector('.sticky-header__hamburger');
  var menuBar = document.querySelector('.menu-bar');

  if (!header) return;

  /* Add sticky class on scroll */
  function handleScroll() {
    if (window.scrollY > 50) {
      header.classList.add('is-sticky');
    } else {
      header.classList.remove('is-sticky');
      // Also close menu-bar if it was opened while sticky
      if (menuBar) menuBar.classList.remove('is-visible');
      if (stickyHamburger) stickyHamburger.classList.remove('is-active');
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // run once on load

  /* Toggle menu-bar when sticky hamburger is clicked */
  if (stickyHamburger && menuBar) {
    stickyHamburger.addEventListener('click', function () {
      var isOpen = menuBar.classList.toggle('is-visible');
      stickyHamburger.classList.toggle('is-active', isOpen);
    });
  }
})();