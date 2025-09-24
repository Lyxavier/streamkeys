"use strict";
(function() {
  // MV3 compatible CraveController

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
    function getPlayer() {
      return document.querySelector("video");
    }

    const controller = new BaseController({
      siteName: "Crave",
      overridePlayPause: true,
      playState: ".jwplayer.jw-state-playing"
    });

    controller.playPause = function() {
      if(this.isPlaying()) {
        try {
          getPlayer().pause();
          console.log("CraveController: playPause - pause");
        } catch(e) {
          console.error("CraveController: playPause - pause error", e);
        }
      } else {
        try {
          getPlayer().play();
          console.log("CraveController: playPause - play");
        } catch(e) {
          console.error("CraveController: playPause - play error", e);
        }
      }
    };
  });
})();
