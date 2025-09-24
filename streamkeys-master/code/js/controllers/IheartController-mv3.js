"use strict";
(function() {
  // MV3 compatible IheartController

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
      siteName: "iHeartRadio",
      play: ".player-controls .icon-play,button[data-test='play-button'] > [aria-labelledby='Play']",
      pause: ".player-controls .icon-pause,button[data-test='play-button'] > [aria-labelledby='Pause']",
      playNext: ".player-controls .icon-skip,button[data-test='skip-button']",
      mute: ".player-controls .icon-volume",
      like: ".player-controls .icon-thumb-up-unfilled",
      dislike: ".player-controls .icon-thumb-down-unfilled",
      playState: ".player-controls .icon-pause,button[data-test='play-button'] > [aria-labelledby='Pause']",
      song: "a.player-song,[data-test='mini-player-track-text'],[data-test='fullscreen-player-track-text']",
      artist: "a.player-artist,[data-test='mini-player-description-text'],[data-test='fullscreen-player-description-text']"
    });
  });
})();
