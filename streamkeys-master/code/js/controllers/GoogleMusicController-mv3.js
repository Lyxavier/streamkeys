"use strict";
(function() {
  // MV3 compatible GoogleMusicController

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
      siteName: "Google Play Music",
      playPause: "[data-id=play-pause]",
      playNext: "[data-id=forward]",
      playPrev: "[data-id=rewind]",
      like: ".rating-container [data-rating='5']",
      dislike: ".rating-container [data-rating='1']",
      playState: "[data-id=play-pause].playing",
      song: "#currently-playing-title",
      artist: "#player-artist",
      album: ".player-album",
      art: "#playerBarArt",
      currentTime: "#time_container_current",
      totalTime: "#time_container_duration"
    });
  });
})();
