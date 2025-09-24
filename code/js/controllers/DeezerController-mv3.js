"use strict";
(function() {
  // MV3 compatible DeezerController

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
      siteName: "Deezer",
      playPrev: "div.player-controls > ul > li:nth-child(1) > button",
      playPause: "div.player-controls > ul > li:nth-child(3) > button",
      playNext: "div.player-controls > ul > li:nth-child(5) > button",
      playState: "svg[data-testid='PauseIcon']",
      dislike: "div.track-actions > ul > li:nth-child(3) > div > button",
      mute: "div.player-options > ul > li:nth-child(1) > ul > li:nth-child(4) > button",
      song: "a.track-link:nth-of-type(1)",
      artist: "a.track-link:nth-of-type(2)"
    });

    controller.dislike = function() {
      if(!document.querySelector("button.dislike-extended")) {
        document.querySelector("div.track-actions > ul > li:last-child > div > button").click();
      }
      document.querySelector("button.dislike-extended").click();
    };
  });
})();
