"use strict";
(function() {
  // MV3 compatible BandcampController

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
      siteName: "Bandcamp",
      playPause: ".playbutton",
      playNext: ".nextbutton",
      playPrev: ".prevbutton",
      playState: ".playbutton.playing",
      song: "a.title_link > span.title",
      artist: "[itemprop=byArtist]",
      art: ".popupImage",
      hidePlayer: true,
      currentTime: ".time_elapsed",
      totalTime: ".time_total"
    });

    controller.getArtData = function(selector) {
      var dataEl = this.doc().querySelector(selector);
      if(dataEl && dataEl.attributes && dataEl.attributes.href) {
        return dataEl.attributes.href.value;
      }

      return null;
    };
  });
})();
