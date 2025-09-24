"use strict";
(function() {
  // MV3 compatible TwitchController

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
      siteName: "Twitch",
      playPause: "[data-a-target='player-play-pause-button']",
      playNext: null,
      playPrev: null
    });

    controller.isPlaying = function() {
      var button = this.doc().querySelector("[data-a-target='player-play-pause-button']");
      return button && button.getAttribute("data-a-player-state") === "playing";
    };
  });
})();
