"use strict";
(function() {
  // MV3 compatible RadioparadiseController

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
      siteName: "Radio Paradise",
      playPause: "#play_button",
      playNext: null,
      playPrev: null
    });

    controller.playPause = function() {
      var doc = document.querySelectorAll("iframe")[0].contentDocument;
      try {
        var playButton = doc.querySelector("#play_button");
        if(playButton.classList.contains("button_active")) {
          try {
            doc.querySelector("input[title=\"Stop Audio\"]").click();
            console.log("playPause");
          } catch (e) {
            console.log("Element not found for click.", e, true);
          }
        } else {
          try {
            playButton.click();
            console.log("playPause");
          } catch (e) {
            console.log("Element not found for click.", e, true);
          }
        }
      } catch (e) {
        console.log("Element not found for click.", e, true);
      }
    };

    controller.isPlaying = function() {
      var doc = document.querySelectorAll("iframe")[0].contentDocument;
      var playButton = doc.querySelector("#play_button");

      return (playButton && playButton.classList.contains("button_active"));
    };

    controller.getSongData = function() {
      var doc = document.querySelectorAll("iframe")[0].contentDocument;
      if(doc.querySelector("#nowplaying_title")) return doc.querySelector("#nowplaying_title").textContent;

      return null;
    };
  });
})();
