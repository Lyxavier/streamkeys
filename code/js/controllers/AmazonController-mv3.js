"use strict";
(function() {
  // MV3 compatible AmazonController

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
    new BaseController({
      siteName: "Amazon Music",
      playPause: ".playbackControlsView .playButton",
      playNext: ".playbackControlsView .nextButton",
      playPrev: ".playbackControlsView .previousButton",
      like: ".playbackControlsView .thumbsUpButton",
      dislike: ".playbackControlsView .thumbsDownButton",
      playState: ".playbackControlsView .playerIconPause",
      song: ".playbackControlsView .trackTitle",
      artist: ".playbackControlsView .trackArtist",
      art: ".albumArtWrapper img",
      hidePlayer: true
    });
  });
})();
