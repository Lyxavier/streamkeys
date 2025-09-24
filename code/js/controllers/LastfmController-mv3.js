"use strict";
(function() {
  // MV3 compatible LastfmController

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
      siteName: "Last.fm",
      play: ".player-bar-btn--play",
      pause: ".player-bar-btn--pause",
      playNext: ".player-bar-btn--next",
      playPrev: ".player-bar-btn--previous",
      like: ".player-bar-btn--love",
      playState: ".player-bar-btn--pause",
      song: ".player-bar-track-name",
      artist: ".player-bar-artist-name"
    });
  });
})();
