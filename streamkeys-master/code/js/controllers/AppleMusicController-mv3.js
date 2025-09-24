"use strict";
(function() {
  // MV3 compatible AppleMusicController

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
      siteName: "Apple Music",
      playPause: "amp-chrome-player",
      playNext: "amp-chrome-player",
      playPrev: "amp-chrome-player",
      song: "amp-lcd",
      artist: "amp-lcd",
      album: "amp-lcd"
    });

    controller.isPlaying = function () {
      return !document.querySelector("amp-chrome-player")?.shadowRoot.querySelector("apple-music-playback-controls")?.shadowRoot.querySelector(".playback-play__pause")?.ariaHidden;
    };
    controller.playPause = function () {
      if (this.isPlaying()) {
        document.querySelector("amp-chrome-player")?.shadowRoot.querySelector("apple-music-playback-controls")?.shadowRoot.querySelector(".playback-play__pause")?.click();
      } else {
        document.querySelector("amp-chrome-player")?.shadowRoot.querySelector("apple-music-playback-controls")?.shadowRoot.querySelector(".playback-play__play")?.click();
      }
    };
    controller.playPrev = function () {
      document.querySelector("amp-chrome-player")?.shadowRoot.querySelector("apple-music-playback-controls")?.shadowRoot.querySelector(".previous")?.click()
    }
    controller.playNext = function () {
      document.querySelector("amp-chrome-player")?.shadowRoot.querySelector("apple-music-playback-controls")?.shadowRoot.querySelector(".next")?.click()
    }
    controller.getSongData = function (selector) {
      var r = null;
      if (selector == "song") {
        r = document.querySelector("amp-lcd")?.shadowRoot.querySelector(".lcd-meta__primary-wrapper .lcd-meta-line__fragment")?.textContent;
      } else if (selector == "artist") {
        r = document.querySelector("amp-lcd")?.shadowRoot.querySelector(".lcd-meta__secondary .lcd-meta-line__fragment:first-child")?.textContent;
      } else if (selector == "album") {
        r = document.querySelector("amp-lcd")?.shadowRoot.querySelector(".lcd-meta__secondary .lcd-meta-line__fragment:last-child")?.textContent;
      }
      return r ?? null;
    };
  });
})();
