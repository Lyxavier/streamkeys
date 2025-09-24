"use strict";
(function() {
  // MV3 compatible DriveplayerController

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
      siteName: "Drive Player",

      play: ".jp-controls .jp-play",
      pause: ".jp-controls .jp-pause",
      playNext: ".jp-controls .jp-next",
      playPrev: ".jp-controls .jp-previous",
      mute: ".jp-controls .jp-mute",

      playState: ".jp-controls .jp-pause[style=\"display: block;\"]",
      artist: ".song.playing .artist",
      song: ".song.playing .title"
    });
  });
})();
