"use strict";
(function() {
  // MV3 compatible AudibleController

  // Load BaseController dynamically
  function loadBaseController(callback) {
    if (window.BaseController) {
      callback(window.BaseController);
      return;
    }

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("js/modules/BaseController-mv3.js");
    script.onload = function() {
      callback(window.BaseController);
    };
    script.onerror = function() {
      console.error("Failed to load BaseController-mv3.js");
    };
    document.head.appendChild(script);
  }

  loadBaseController(function(BaseController) {
    const controller = new BaseController({
      siteName: "Audible",
      playPause: ".adbl-play-pause",
      playNext: ".adbl-forward",
      playPrev: ".adbl-back",
      playState: ".adbl-pause",
      buttonSwitch: true
    });

    controller.isPlaying = function() {
      var playEl = this.doc().querySelector(this.selectors.play),
        isPlaying = false;

      if(this.buttonSwitch) {
        // If playEl does not exist then it is currently playing
        isPlaying = (playEl === null);
      }
      else if(this.selectors.playState) {
        // Check if the play state element exists and is visible
        var playStateEl = this.doc().querySelector(this.selectors.playState);
        // Override the second check here since it fails even though it shouldn't
        isPlaying = !!(playStateEl);
      }
      else if(playEl) {
        isPlaying = (window.getComputedStyle(playEl, null).getPropertyValue("display") === "none");
      }
      return isPlaying;
    };
  });
})();
