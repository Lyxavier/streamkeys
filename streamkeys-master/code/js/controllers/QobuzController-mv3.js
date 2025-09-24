"use strict";
(function() {
  // MV3 compatible QobuzController

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
    new BaseController({
      siteName: "Qobuz",
      play: ".pct-player-play",
      pause: ".pct-player-pause",
      playNext: ".pct-player-next",
      playPrev: ".pct-player-prev",
      buttonSwitch: true,
      playState: ".pct-player-pause",
      song: ".current-track",
      artist: ".link-artist"
    });
  });
})();
