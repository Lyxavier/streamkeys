"use strict";
(function() {
  // MV3 compatible SongzaController

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
      siteName: "Songza",
      playPause: ".miniplayer-control-play-pause",
      playNext: ".miniplayer-control-skip",
      mute: ".miniplayer-volume-icon",
      like: ".thumb-up",
      dislike: ".thumb-down",
      playState: ".player-state-play",
      song: ".miniplayer-info-track-title"
    });

    controller.getStateData = function() {
      var artistSpan = document.querySelector(".miniplayer-info-artist-name a") &&
                      document.querySelector(".miniplayer-info-artist-name a").textContent.substring(3);

      return {
        song: this.getSongData(this.selectors.song),
        artist: artistSpan,
        isPlaying: this.isPlaying(),
        siteName: this.siteName,
        canPlayPause: true,
        canPlayNext: true,
        canLike: true,
        canDislike: true
      };
    };
  });
})();
