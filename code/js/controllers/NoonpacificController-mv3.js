"use strict";
(function() {
  // MV3 compatible NoonpacificController

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
      play: ["#player a:nth-child(2)", ".fa-play"],
      pause: ["#player a:nth-child(3)", ".fa-pause"],
      playNext: ["#player a:nth-child(4)", ".fa-forward"],
      playPrev: ["#player a:nth-child(1)", ".fa-backward"],
      playState: ["#player .ng-hide .icon-play", ".fa-pause"],
      song: ["h1.break-word", ".audio-player-song p"],
      artist: [null, ".audio-player-artist p"]
    };

    const controller = new BaseController({
      siteName: "Noon Pacific"
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
