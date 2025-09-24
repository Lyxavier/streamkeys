"use strict";
(function() {
  // MV3 compatible BeatportController

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
    const multiSelectors = {
      play: [".omniplayer button[title=Play]", ".video-btn.play-icon"],
      pause: [".omniplayer button[title=Pause]", ".video-btn.pause-icon"],
      playNext: [".omniplayer--action-icon.next", null],
      playState: [".omniplayer.is-playing", null],
      mute: [".omniplayer--volume-icon", "#mute"],
      like: [".omniplayer--action-icon.heart", null],
      song: [".omniplayer--title", ".stream-description .overview h1"],
      artist: [".omniplayer--artist", ".channel-text h1"]
    };

    const controller = new BaseController({
      siteName: "Beatport"
    });

    controller.checkPlayer = function() {
      const that = this;

      if(this.doc().querySelector(multiSelectors.play[0]) || this.doc().querySelector(multiSelectors.pause[0])) {
        Object.keys(multiSelectors).forEach(function(key) {
          that.selectors[key] = multiSelectors[key][0];
        });
      } else {
        Object.keys(multiSelectors).forEach(function(key) {
          that.selectors[key] = multiSelectors[key][1];
        });
      }
    };
  });
})();
