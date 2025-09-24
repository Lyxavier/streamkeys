"use strict";
(function() {
  // MV3-compatible MouseEventController
  // This class extends BaseController-mv3 and adds mouse event dispatching capabilities

  function MouseEventController() {
    // Apply BaseController constructor
    if (window.BaseController) {
      window.BaseController.apply(this, arguments);
    }
  }

  // Mouse event types
  const mouseEventTypes = [
    "click", "dblclick", "mousedown", "mouseenter", "mouseleave",
    "mousemove", "mouseout", "mouseover", "mouseup"
  ];

  /**
   * Dispatch mouse events
   * @param {Element} element - Target element
   * @param {String} eventType - Event type
   * @param {Object} mouseOpts - Mouse event options
   */
  function dispatchMouseEvent(element, eventType, mouseOpts) {
    if (!element) return;

    mouseOpts = mouseOpts || {};
    const event = new MouseEvent(eventType, {
      bubbles: mouseOpts.bubbles !== false,
      cancelable: mouseOpts.cancelable !== false,
      view: window,
      button: mouseOpts.button || 0,
      buttons: mouseOpts.buttons || 1,
      clientX: mouseOpts.clientX || 0,
      clientY: mouseOpts.clientY || 0,
      screenX: mouseOpts.screenX || 0,
      screenY: mouseOpts.screenY || 0,
      ctrlKey: mouseOpts.ctrlKey || false,
      shiftKey: mouseOpts.shiftKey || false,
      altKey: mouseOpts.altKey || false,
      metaKey: mouseOpts.metaKey || false
    });

    element.dispatchEvent(event);
  }

  // Set up prototype chain
  MouseEventController.prototype = Object.create(window.BaseController ? window.BaseController.prototype : {});
  MouseEventController.prototype.constructor = MouseEventController;

  // Add mouse event methods
  mouseEventTypes.forEach(function(eventType) {
    MouseEventController.prototype[eventType] = function(opts, mouseOpts) {
      opts = opts || {};
      if (opts.selectorButton === null) {
        console.log("MouseEventController: disabled", opts.action);
        return;
      }

      try {
        const button = this.doc().querySelector(opts.selectorButton);
        if (button) {
          dispatchMouseEvent(button, eventType, mouseOpts);
          if (opts.action) {
            console.log("MouseEventController:", opts.action);
          }
        } else {
          console.warn("MouseEventController: Element not found for " + eventType + ".", opts.selectorButton);
        }
      } catch (e) {
        console.error("MouseEventController: Error dispatching " + eventType + ":", e);
      }

      if (this.updatePlayerState) {
        this.updatePlayerState();
      }
    };
  });

  // Make MouseEventController globally available
  window.MouseEventController = MouseEventController;
})();
