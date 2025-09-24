"use strict";
(function() {
  // MV3 compatible YandexRadioController (MouseEventController)

  // Load dependencies dynamically
  function loadControllers(callback) {
    let loadedCount = 0;
    const totalCount = 2;

    function checkComplete() {
      loadedCount++;
      if (loadedCount === totalCount && window.BaseController && window.MouseEventController) {
        callback(window.MouseEventController);
      }
    }

    // Load BaseController first
    if (!window.BaseController) {
      const baseScript = document.createElement("script");
      baseScript.src = chrome.runtime.getURL("js/modules/BaseController-mv3.js");
      baseScript.onload = checkComplete;
      baseScript.onerror = function() {
        console.error("Failed to load BaseController-mv3.js");
      };
      document.head.appendChild(baseScript);
    } else {
      checkComplete();
    }

    // Load MouseEventController
    if (!window.MouseEventController) {
      const mouseScript = document.createElement("script");
      mouseScript.src = chrome.runtime.getURL("js/modules/MouseEventController-mv3.js");
      mouseScript.onload = checkComplete;
      mouseScript.onerror = function() {
        console.error("Failed to load MouseEventController-mv3.js");
      };
      document.head.appendChild(mouseScript);
    } else {
      checkComplete();
    }
  }

  loadControllers(function(MouseEventController) {
    new MouseEventController({
      siteName: "Yandex Radio",
      playPause: ".player-controls__btn_play",
      playNext: ".player-controls__btn_next",
      playPrev: ".player-controls__btn_prev",
      mute: ".player-controls__btn_volume",
      like: ".player-controls__btn_like",
      dislike: ".player-controls__btn_dislike",

      playState: ".player-controls__btn_play_pause",

      song: ".track__title",
      artist: ".track__artists"
    });
  });
})();
