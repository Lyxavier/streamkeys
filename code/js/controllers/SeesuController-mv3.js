"use strict";
(function() {
  // MV3 compatible SeesuController

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
      siteName: "Seesu",
      playPause: "#override",
      playNext: "#override",
      playPrev: "#override",
      playState: ".playing-file",
      overridePlayPrev: true,
      overridePlayPause: true,
      overridePlayNext: true
    });

    /* Overrides */
    controller.playPause = function() {
      document.dispatchEvent(new CustomEvent("streamkeys-cmd", { "detail": "playPause" }));
    };
    controller.playNext = function() {
      document.dispatchEvent(new CustomEvent("streamkeys-cmd", { "detail": "next" }));
    };
    controller.playPrev = function() {
      document.dispatchEvent(new CustomEvent("streamkeys-cmd", { "detail": "prev" }));
    };

    /* Inject script to interact with parent DOM */
    controller.injectScript({ url: "/js/inject/seesu_inject.js" });
  });
})();
