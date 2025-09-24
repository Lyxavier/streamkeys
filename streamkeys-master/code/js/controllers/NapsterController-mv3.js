"use strict";
(function() {
  // MV3 compatible NapsterController

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
      siteName: "Napster",
      play: ".player-play-button .icon-play-button",
      pause: ".player-play-button .icon-pause2",
      playNext: ".player-advance-button",
      playPrev: ".player-rewind-button",
      like: ".like-button",
      dislike: ".dislike-button",
      buttonSwitch: true,
      song: ".player-track",
      artist: ".player-artist"
    });
  });
})();
