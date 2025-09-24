"use strict";
(function() {
  // MV3 compatible FeedlyController

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
      siteName: "Feedly",
      playPause: "audio",
      playNext: ".slideBumper-right",
      playPrev: ".slideBumper-left",
      song: ".entryTitle"
    });

    controller.getPlayer = function() {
      return document.querySelector("audio");
    };

    controller.isPlaying = function() {
      try {
        return !this.getPlayer().paused;
      } catch (e) {
        return false;
      }
    };

    controller.playPause = function() {
      if(this.isPlaying()) {
        try {
          this.getPlayer().pause();
          console.log("FeedlyController: playPause - pause");
        } catch(e) {
          console.error("FeedlyController: player error", e);
        }
      } else {
        try {
          this.getPlayer().play();
          console.log("FeedlyController: playPause - play");
        } catch(e) {
          console.error("FeedlyController: player error", e);
        }
      }
    };
  });
})();
