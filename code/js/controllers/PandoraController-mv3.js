"use strict";
(function() {
  // MV3 compatible PandoraController

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
    // Playlist controls, Station controls
    const multiSelectors = {
      playNext: [".Tuner__Control__SkipForward__Button", ".Tuner__Control__Skip__Button"],
      playPrev: [".Tuner__Control__SkipBack__Button", ".ReplayButton:not(.TunerControl--disabled)"],
      album: [".HeroCard__sourceInfo__album", ".nowPlayingTopInfo__current__albumName"]
    };

    const controller = new BaseController({
      siteName: "Pandora",
      playState: "button.PlayButton[aria-checked=true]",
      playPause: ".PlayButton",
      // Liking an already liked song unlikes the song so enable if song isn't already liked
      like: ".ThumbUpButton[aria-checked=false]",
      dislike: ".ThumbDownButton",
      song:  ".Tuner__Audio__TrackDetail__title",
      artist: ".Tuner__Audio__TrackDetail__artist",
      art: ".ImageLoader [data-qa='mini_track_image']",
      currentTime: ".VolumeDurationControl__Duration [data-qa='elapsed_time']",
      totalTime: ".VolumeDurationControl__Duration [data-qa='remaining_time']"
    });

    controller.checkPlayer = function () {
      const that = this;

      if (this.doc().querySelector(multiSelectors.playNext[0])) {
        Object.keys(multiSelectors).forEach(function (key) {
          that.selectors[key] = multiSelectors[key][0];
        });
      } else {
        Object.keys(multiSelectors).forEach(function (key) {
          that.selectors[key] = multiSelectors[key][1];
        });
      }
    };
  });
})();
