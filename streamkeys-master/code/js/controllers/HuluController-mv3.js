"use strict";
(function() {
  // MV3 compatible HuluController (MouseEventController)

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
      siteName: "Hulu",
      playPause: "div.controls__playback-button",
      playNext: "div.controls__next-button",
      playPrev: "div.controls__previous-button",
      mute: "div.controls__volume-button",
      like: "",
      dislike: "",

      playState: "div.controls__playback-button--playing",

      song: "div.controls__details-metadata h4",
      artist: "div.controls__details-metadata h5"
    });

    controller.isPlaying = function () {
      return !!(this.doc().querySelector("div.controls__playback-button--playing"));
    };
  });
})();
