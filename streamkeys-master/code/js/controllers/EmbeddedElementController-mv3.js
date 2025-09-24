"use strict";
(function() {
  // MV3 compatible EmbeddedElementController

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
      return document.getElementsByTagName("audio")[0]
        || document.getElementsByTagName("video")[0];
    }

    // Don't create a controller if we can't find a player
    if(!getPlayer()) return;

    const controller = new BaseController({
      siteName: "Embedded Element",
      song: "title",
      overridePlayPrev: true,
      overridePlayPause: true,
      overridePlayNext: true
    });

    /* Overrides */
    controller.isPlaying = function() {
      try {
        return !getPlayer().paused;
      } catch (e) {
        return false;
      }
    };
    controller.playPause = function() {
      if(this.isPlaying()) {
        try {
          getPlayer().pause();
          console.log("playPause");
        } catch(e) {
          console.log("playPause", e, true);
        }
      } else {
        try {
          getPlayer().play();
          console.log("playPause");
        } catch(e) {
          console.log("playPause", e, true);
        }
      }
    };
    controller.playNext = function() {
      try {
        getPlayer().currentTime += 15;
        console.log("playNext");
      } catch (exception) {
        console.log("playNext", exception, true);
      }
    };
    controller.playPrev = function() {
      try {
        getPlayer().currentTime -= 15;
        console.log("playPrev");
      } catch (exception) {
        console.log("playPrev", exception, true);
      }
    };
  });
})();
