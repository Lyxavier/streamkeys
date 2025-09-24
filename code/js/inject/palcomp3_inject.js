"use strict";
(function() {
  // Inline SKLog functionality for MV3 compatibility
  function sk_log(msg, obj, err) {
    if(msg) {
      obj = obj || "";
      if(err) {
        console.error("STREAMKEYS-ERROR: " + msg, obj);
      } else {
        console.log("STREAMKEYS-INFO: " + msg, obj);
      }
    }
  }

  // Vanilla JS helper for jQuery methods
  function clickElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
      // Simulate mousedown and mouseup events
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      return true;
    }
    return false;
  }

  document.addEventListener("streamkeys-cmd", function(e) {
    if(e.detail === "next") {
      try {
        // Try jQuery first, fallback to vanilla JS
        if (typeof $ !== "undefined") {
          $(".p_avancar").mousedown().mouseup();
        } else {
          clickElement(".p_avancar");
        }
        sk_log("playNext");
      } catch (exception) {
        sk_log("playNext", exception, true);
      }
    } else if(e.detail === "prev") {
      try {
        // Try jQuery first, fallback to vanilla JS
        if (typeof $ !== "undefined") {
          $(".p_voltar").mousedown().mouseup();
        } else {
          clickElement(".p_voltar");
        }
        sk_log("playPrev");
      } catch (exception) {
        sk_log("playPrev", exception, true);
      }
    }
  });
})();
