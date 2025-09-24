"use strict";
(function() {
  // MV3 compatible PrimevideoController

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
      siteName: "Amazon Prime Video",
      playPause: ".pausedOverlay",
      playState: ".overlaysContainer .pausedIcon",
      playNext: ".overlaysContainer .fastSeekForward",
      playPrev: ".overlaysContainer .fastSeekBack",
      song: ".topPanel .contentTitlePanel .title"
    });

    /**
     * Prime Video does not use button clicks, rather, it uses pointer events to handle both mouse and
     * touch events simultaneously.
     */
    controller.playPause = function() {
      try {
        const element = this.doc().querySelector(this.selectors.playPause);

        // Player is always loaded in the background and video will start playing in the background if allowed.
        // Hence, need to prevent from playing the video if the player is hidden
        if (window.getComputedStyle(element, null).getPropertyValue("display") === "none") {
          return;
        }

        element.dispatchEvent(new PointerEvent("pointerup"));
        console.log("PrimevideoController: playPause");
      } catch(e) {
        console.error("PrimevideoController: Element not found for click", this.selectors.playPause, e);
      }

      // Update the player state after a click
      this.updatePlayerState();
    };
  });
})();
