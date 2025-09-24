"use strict";
(function() {
  // MV3 compatible MixcloudController

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
      siteName: "Mixcloud",
      play: ".player-open [aria-label='Play']",
      pause: ".player-open [aria-label='Pause']",
      buttonSwitch: true,
      like: ".player-icons.favorite:not(.favorite-state)",
      dislike: ".player-icons.favorite.favorite-state",
      overridePlayNext: true,
      overridePlayPrev: true,
      playState: ".player-control.pause-state",
      song: ".player-cloudcast-title",
      artist: ".player-cloudcast-author-link"
    });

    controller.playNext = function() {
      this.doc().querySelector("audio").currentTime += 30;
    };
    controller.playPrev = function() {
      this.doc().querySelector("audio").currentTime -= 30;
    };
  });
})();
