"use strict";
(function() {
  // MV3 compatible 8tracksController

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
    const playNextOptions = [".next_track", ".player_next", ".next-track"];

    new BaseController({
      siteName: "8tracks",
      play: "#player_play_button",
      pause: "#player_pause_button",
      playNext: function() {
        for (var i = 0; i < playNextOptions.length; i++) {
          var el = this.doc().querySelector(playNextOptions[i]);
          if (el && el.style.display !== "none") {
            return playNextOptions[i];
          }
        }
        // None are valid, just return the first selector
        return playNextOptions[0];
      },
      mute: ".volume-mute",
      like: ".mix-like.inactive",
      dislike: ".mix-like.active",

      song: "li.track.now_playing div.title_container div.title_artist span.t",
      artist: "li.track.now_playing div.title_container div.title_artist span.a"
    });


  });
})();
