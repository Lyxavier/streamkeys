"use strict";
(function() {
  // MV3 compatible NetflixController

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
    const multiSelectors = {
      play: [".player-play-pause.play", ".button-nfplayerPlay"],
      pause: [".player-play-pause.pause", ".button-nfplayerPause"],
      playNext: [".player-next-episode", ".button-nfplayerNextEpisode"],
      mute: [".player-control-button.volume", ".button-volumeLow, .button-volumeMedium, .button-volumeMax, .button-volumeMuted"],
      playState: [".player-play-pause.pause",".button-nfplayerPause"],
      song: [".player-status-main-title", ".title"]
    };

    const controller = new BaseController({
      siteName: "Netflix"
    });

    controller.checkPlayer = function() {
      const that = this;

      if(this.doc().querySelector(multiSelectors.play[0]) || this.doc().querySelector(multiSelectors.pause[0])) {
        Object.keys(multiSelectors).forEach(function(key) {
          that.selectors[key] = multiSelectors[key][0];
        });
      } else {
        Object.keys(multiSelectors).forEach(function(key) {
          that.selectors[key] = multiSelectors[key][1];
        });
      }
    };
  });
})();
