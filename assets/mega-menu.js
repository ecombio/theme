/**
 * Mega Menu
 * File: assets/mega-menu.js
 *
 * The mega-menu panel in mega-menu.css opens on :hover by default, which
 * works for mouse users but isn't reachable by keyboard. This file adds
 * an .is-open class hook (toggled on the trigger's click, and managed via
 * aria-expanded + Escape + outside-click) so the exact same panel also
 * opens for keyboard/touch users — no markup or CSS duplication needed.
 *
 * CHANGELOG (this revision):
 * - FIXED: mega-menu.css previously centered each panel on its trigger
 *   via `left: 50%; transform: translateX(-50%)`. For nav items near
 *   the edges of a wide menu bar, this pushed the panel off-screen.
 *   mega-menu.css now defaults to `left: 0`, and this file measures
 *   each panel against the viewport on open (mouseenter / click /
 *   focusin) and applies a compensating inline `left` offset so the
 *   panel always stays fully on-screen, however many trigger items
 *   are in the bar or however wide any individual panel is. Position
 *   is recalculated on window resize for whichever panel is open.
 *
 * Pure JS — no Liquid, no build step, no dependencies.
 *
 * Expected markup (rendered inline by sections/header-menu.liquid):
 *
 *   <li class="menu-bar__item menu-bar__item--has-mega">
 *     <a class="mega-menu-trigger" data-mega-trigger
 *        aria-haspopup="true" aria-expanded="false">...</a>
 *     <div class="mega-menu" data-mega-panel>...</div>
 *   </li>
 */
(function () {
  "use strict";

  function MegaMenu(trigger) {
    this.trigger = trigger;
    this.item = trigger.closest(".menu-bar__item--has-mega");
    this.panel = this.item ? this.item.querySelector("[data-mega-panel]") : null;
  }

  MegaMenu.prototype.isOpen = function () {
    return this.item.classList.contains("is-open");
  };

  /**
   * Keeps the panel inside the viewport horizontally. Left-aligns to
   * the trigger by default (matches the CSS default of `left: 0`),
   * then shifts left only as far as needed to avoid overflowing the
   * right edge — and never past the point where it would overflow the
   * left edge instead.
   */
  MegaMenu.prototype.position = function () {
    var panel = this.panel;
    if (!panel) return;

    var margin = 24; // keep panel this far from either viewport edge

    // Reset before measuring so a stale offset doesn't skew the calc.
    panel.style.left = "0px";

    var triggerRect = this.item.getBoundingClientRect();
    var panelWidth = panel.offsetWidth;

    var overflowRight =
      triggerRect.left + panelWidth - (window.innerWidth - margin);

    var offset = 0;
    if (overflowRight > 0) {
      offset = -overflowRight;
    }

    // Don't let it shift so far left it overflows the left edge instead.
    var minOffset = margin - triggerRect.left;
    if (offset < minOffset) offset = minOffset;

    panel.style.left = offset + "px";
  };

  MegaMenu.prototype.open = function () {
    this.item.classList.add("is-open");
    this.trigger.setAttribute("aria-expanded", "true");
  };

  MegaMenu.prototype.close = function () {
    this.item.classList.remove("is-open");
    this.trigger.setAttribute("aria-expanded", "false");
  };

  MegaMenu.prototype.toggle = function () {
    this.isOpen() ? this.close() : this.open();
  };

  function init() {
    var triggers = document.querySelectorAll("[data-mega-trigger]");
    var instances = [];

    triggers.forEach(function (trigger) {
      var instance = new MegaMenu(trigger);
      if (!instance.panel) return;
      instances.push(instance);

      trigger.addEventListener("click", function (event) {
        event.preventDefault();

        // Close any other open mega menu before opening this one.
        instances.forEach(function (other) {
          if (other !== instance && other.isOpen()) other.close();
        });

        instance.position();
        instance.toggle();
      });

      // CSS opens the panel directly on :hover (no .is-open class
      // involved), so position on mouseenter too — otherwise the
      // panel can render off-screen for mouse-only users before any
      // click ever happens.
      instance.item.addEventListener("mouseenter", function () {
        instance.position();
      });

      // Keyboard users tabbing in via :focus-within — same reasoning.
      instance.item.addEventListener("focusin", function () {
        instance.position();
      });

      instance.item.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && instance.isOpen()) {
          instance.close();
          instance.trigger.focus();
        }
      });

      // Close when focus moves out of the item entirely (tabbing through).
      instance.item.addEventListener("focusout", function () {
        requestAnimationFrame(function () {
          if (instance.isOpen() && !instance.item.contains(document.activeElement)) {
            instance.close();
          }
        });
      });
    });

    if (!instances.length) return;

    // Click outside any open mega menu closes it.
    document.addEventListener("click", function (event) {
      instances.forEach(function (instance) {
        if (instance.isOpen() && !instance.item.contains(event.target)) {
          instance.close();
        }
      });
    });

    // Global Escape fallback.
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        instances.forEach(function (instance) {
          instance.close();
        });
      }
    });

    // Recompute position for whichever panel is currently visible on
    // resize — covers both the .is-open (click/keyboard) and the pure
    // CSS :hover case.
    window.addEventListener("resize", function () {
      instances.forEach(function (instance) {
        if (instance.isOpen() || instance.item.matches(":hover")) {
          instance.position();
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();