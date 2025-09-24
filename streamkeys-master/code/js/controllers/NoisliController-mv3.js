"use strict";
(function() {
  // MV3 compatible NoisliController

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
    var controller = new BaseController({
      siteName: "Noisli",
      playPause: ".mute-header img:not([style*=\"none;\"])",
      playNext: "#random-button-out",
      mute: ".mute-header img:not([style*=\"none;\"])",
      playState: "#sound-button-out:not([style*=\"none;\"])",
      song: ".presets-ul .clicked",
      buttonSwitch: true
    });

    controller.isPlaying = function() {
      return !!this.doc().querySelector(this.selectors.playState);
    };
  });
})();
