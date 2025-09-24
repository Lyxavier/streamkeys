"use strict";
(function() {
  // MV3 compatible JamendoController

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
      siteName: "Jamendo Music",
      playPause: ".player-controls_play",
      playNext: ".player-controls_next",
      playPrev: ".player-controls_previous",
      mute: ".player-volume_mute",
      like: "ul.player-mini_track-actions li:first-child > button:not(.is-on)",
      dislike: "ul.player-mini_track-actions li:first-child > button.is-on",
      playState: ".player-controls.is-play",
      song: ".player-mini_track_information_title",
      artist: ".player-mini_track_information_artist",
      hidePlayer: true
    });
  });
})();
