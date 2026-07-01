/**
 * Sticky Header Behavior
 * File: assets/sticky-header.js
 */

(function () {
  'use strict';

  var header = document.getElementById('main-header');
  var stickyHamburger = document.querySelector('.sticky-header__hamburger');
  var menuBar = document.querySelector('.menu-bar');

  if (!header) return;

  /* Handle scroll - add sticky + shadow */
  function handleScroll() {
    if (window.scrollY > 60) {
      header.classList.add('is-sticky');
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-sticky');
      header.classList.remove('is-scrolled');

      // Reset menu when scrolling back to top
      if (menuBar) menuBar.classList.remove('is-visible');
      if (stickyHamburger) stickyHamburger.classList.remove('is-active');
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  /* Toggle menu bar + change icon when hamburger is clicked */
  if (stickyHamburger && menuBar) {
    stickyHamburger.addEventListener('click', function () {
      var isOpen = menuBar.classList.toggle('is-visible');
      stickyHamburger.classList.toggle('is-active', isOpen);
    });
  }
})();