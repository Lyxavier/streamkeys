"use strict";
(function() {
  // MV3 compatible MusicForProgrammingController

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
      siteName: "Music for Programming",
      play: "#player_playpause",
      pause: "#player_playpause",
      playNext: "#player_ffw.active",
      playPrev: "#player_rew.active",
      song: "#episodes .selected"
    });

    controller.isPlaying = function() {
      return document.querySelector(this.selectors.play).innerText === "[PAUSE]";
    };
  });
})();
