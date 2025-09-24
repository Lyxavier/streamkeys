"use strict";
(function() {
  // MV3 compatible MyspaceController

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
      siteName: "Myspace",
      playPause: ".play",
      playNext: ".next",
      playPrev: ".previous",
      mute: "#volumeBtn",
      playState: "[data-original-title=Pause]",
      song: ".track > .title > a",
      artist: ".track > .artist > a",
      hidePlayer: true
    });
  });
})();
