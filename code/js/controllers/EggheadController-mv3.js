"use strict";
(function() {
  // MV3 compatible EggheadController

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
      siteName: "Egghead",
      playPause: ".play-button",
      playNext: null,
      playPrev: null
    });

    controller.isPlaying = function () {
      return !(this.doc().querySelector(this.selectors.playPause + ".paused"));
    };
  });
})();
