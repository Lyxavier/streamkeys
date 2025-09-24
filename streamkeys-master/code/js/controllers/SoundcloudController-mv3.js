"use strict";
(function() {
  // MV3 compatible SoundcloudController

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
      siteName: "SoundCloud",
      playPause: ".playControl",
      playNext: ".skipControl__next",
      playPrev: ".skipControl__previous",
      mute: ".volume__iconWrapper",
      like: ".playbackSoundBadge__like",
      playState: ".playControl.playing",
      song: ".playbackSoundBadge__titleContextContainer > a",
      artist: ".playbackSoundBadge__titleContextContainer > .playbackSoundBadge__title > a > span:nth-of-type(2)",
      hidePlayer: true
    });
  });
})();
