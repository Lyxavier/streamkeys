"use strict";
(function() {
  // MV3 compatible SpotifyController

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
    window.streamkeysController = new BaseController({
      siteName: "Spotify",
      play: "[data-testid=control-button-playpause][aria-label=Play]",
      pause: "[data-testid=control-button-playpause][aria-label=Pause]",
      playPause: "[data-testid=control-button-playpause]",
      playPrev: ".player-controls__left button:nth-child(2)",
      playNext: "[data-testid=control-button-skip-forward]",
      like: "button[aria-label='Save to Your Library'].control-button-heart",
      dislike: "button[aria-label='Remove from Your Library'].control-button-heart",
      buttonSwitch: true,
      mute: "volume-bar .volume-bar__icon-button",
      song: "[data-testid=context-item-info-title] [data-testid=context-item-link]",
      artist: "[data-testid=context-item-info-subtitles] [data-testid=context-item-info-artist]",
      art: ".cover-art img",
      currentTime: "[data-testid=playback-position]",
      totalTime: "[data-testid=playback-duration]"
    });
  });
})();
