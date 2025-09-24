"use strict";
(function() {
  // MV3 compatible TidalController

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
      siteName: "Tidal",
      play: "[data-test=play]",
      pause: "[data-test=pause]",
      playNext: "[data-test=next]",
      playPrev: "[data-test=previous]",
      dislike: "[data-test=block]",
      song: "[data-test=track-title]",
      artist: "[data-test=artist-title]",
      buttonSwitch : true
    });

    controller.dislike = function() {
      const blockTrack = "[data-test=block-track]";
      const block = "[data-test=play-controls] > [data-test=block]";

      if(!document.querySelector(blockTrack)) {
        document.querySelector(block).click();
      }
      document.querySelector(blockTrack).click();
    };
  });
})();
