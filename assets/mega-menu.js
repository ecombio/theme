/**
 * Mega Menu
 * File: assets/mega-menu.js
 *
 * Core interaction logic for the desktop mega-menu panel rendered inline
 * inside sections/header-menu.liquid (case 'mega'). Pure JS â€” no Liquid,
 * no build step, no dependencies.
 *
 * Expected markup (rendered by header-menu.liquid):
 *
 *   <li class="menu-bar__item menu-bar__item--has-mega">
 *     <a class="mega-menu-trigger" data-mega-trigger
 *        aria-haspopup="true" aria-expanded="false">...</a>
 *     <div class="mega-menu" data-mega-panel>...</div>
 *   </li>
 *
 * Behavior:
 *   - Click / Enter / Space on the trigger toggles its panel.
 *   - Hover (desktop, fine pointer) opens with a short intent delay and
 *     closes with a short close delay so moving toward the panel doesn't
 *     immediately dismiss it.
 *   - Only one mega menu is open at a time.
 *   - Escape closes the open menu and returns focus to its trigger.
 *   - Clicking or focusing outside the open menu closes it.
 *   - aria-expanded is kept in sync on the trigger for screen readers.
 */
(function () {
  "use strict";

  var OPEN_DELAY = 100;   // ms, hover intent before opening
  var CLOSE_DELAY = 150;  // ms, grace period before closing on mouseleave
  var hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var instances = [];
  var openTimer = null;
  var closeTimer = null;

  function MegaMenu(trigger) {
    this.trigger = trigger;
    this.item = trigger.closest(".menu-bar__item--has-mega");
    this.panel = this.item ? this.item.querySelector("[data-mega-panel]") : null;
    if (!this.panel) return;

    this.isOpen = false;
    this.bindEvents();
    instances.push(this);
  }

  MegaMenu.prototype.open = function () {
    if (this.isOpen) return;
    clearTimeout(closeTimer);

    // Close any other open mega menu first.
    instances.forEach(function (instance) {
      if (instance !== this && instance.isOpen) instance.close();
    }, this);

    this.isOpen = true;
    this.panel.classList.add("is-open");
    this.trigger.setAttribute("aria-expanded", "true");
  };

  MegaMenu.prototype.close = function () {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.panel.classList.remove("is-open");
    this.trigger.setAttribute("aria-expanded", "false");
  };

  MegaMenu.prototype.scheduleOpen = function () {
    var self = this;
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    openTimer = setTimeout(function () {
      self.open();
    }, OPEN_DELAY);
  };

  MegaMenu.prototype.scheduleClose = function () {
    var self = this;
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      self.close();
    }, CLOSE_DELAY);
  };

  MegaMenu.prototype.bindEvents = function () {
    var self = this;

    // Click toggles (works for touch + mouse + keyboard activation).
    this.trigger.addEventListener("click", function (event) {
      if (self.panel.querySelector("[data-mega-panel]") === null) {
        event.preventDefault();
      }
      self.isOpen ? self.close() : self.open();
    });

    // Escape closes and returns focus to the trigger.
    this.item.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && self.isOpen) {
        self.close();
        self.trigger.focus();
      }
    });

    if (hoverCapable) {
      this.item.addEventListener("mouseenter", function () {
        self.scheduleOpen();
      });
      this.item.addEventListener("mouseleave", function () {
        self.scheduleClose();
      });
    }

    // Closing when focus leaves the item entirely (keyboard tabbing through).
    this.item.addEventListener("focusout", function (event) {
      requestAnimationFrame(function () {
        var activeEl = document.activeElement;
        if (self.isOpen && !self.item.contains(activeEl)) {
          self.close();
        }
      });
    });
  };

  function closeAll() {
    instances.forEach(function (instance) {
      instance.close();
    });
  }

  function init() {
    var triggers = document.querySelectorAll("[data-mega-trigger]");
    triggers.forEach(function (trigger) {
      new MegaMenu(trigger);
    });

    // Click outside any mega menu closes whatever is open.
    document.addEventListener("click", function (event) {
      var openInstance = instances.find(function (instance) {
        return instance.isOpen;
      });
      if (openInstance && !openInstance.item.contains(event.target)) {
        closeAll();
      }
    });

    // Global Escape fallback (covers focus outside any item).
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeAll();
    });

    // Close everything if the mobile drawer opens, to avoid stacked nav UI.
    document.addEventListener("mobile-nav:open", closeAll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();