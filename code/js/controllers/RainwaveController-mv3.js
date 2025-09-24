"use strict";
(function() {
  // MV3 compatible RainwaveController (MouseEventController)

  // Load dependencies dynamically
  function loadControllers(callback) {
    let loadedCount = 0;
    const totalCount = 2;

    function checkComplete() {
      loadedCount++;
      if (loadedCount === totalCount && window.BaseController && window.MouseEventController) {
        callback(window.MouseEventController);
      }
    }

    // Load BaseController first
    if (!window.BaseController) {
      const baseScript = document.createElement("script");
      baseScript.src = chrome.runtime.getURL("js/modules/BaseController-mv3.js");
      baseScript.onload = checkComplete;
      baseScript.onerror = function() {
        console.error("Failed to load BaseController-mv3.js");
      };
      document.head.appendChild(baseScript);
    } else {
      checkComplete();
    }

    // Load MouseEventController
    if (!window.MouseEventController) {
      const mouseScript = document.createElement("script");
      mouseScript.src = chrome.runtime.getURL("js/modules/MouseEventController-mv3.js");
      mouseScript.onload = checkComplete;
      mouseScript.onerror = function() {
        console.error("Failed to load MouseEventController-mv3.js");
      };
      document.head.appendChild(mouseScript);
    } else {
      checkComplete();
    }
  }

  loadControllers(function(MouseEventController) {
    var controller = new MouseEventController({
      siteName: "Rainwave",
      playPause: "span#pause_play_button",
      playNext: "span#ff_button",
      playPrev: "span#rw_button",
      mute: "span#vol_button",
      like: "span#fav_button",
      dislike: "",

      playState: "span#pause_play_button.fa-pause",

      song: "span#song_title",
      artist: "span#song_artist"
    });

    controller.playPause = function() {
      this.mouseclick({ selectorButton: this.selectors.playPause });
    };
  });
})();
