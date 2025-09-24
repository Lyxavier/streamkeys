"use strict";
(function() {
  // MV3 compatible PlexController (MouseEventController)

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
    const controller = new MouseEventController({
      siteName: "Plex.tv",
      play: "div[class^=ControlsContainer] button[data-qa-id=resumeButton], div[class^=ControlsContainer] button[data-testid=resumeButton]",
      pause: "div[class^=ControlsContainer] button[data-qa-id=pauseButton], div[class^=ControlsContainer] button[data-testid=pauseButton]",
      playNext: "div[class^=ControlsContainer] button[data-qa-id=nextButton], div[class^=ControlsContainer] button[data-testid=nextButton]",
      playPrev: "div[class^=ControlsContainer] button[data-qa-id=previousButton], div[class^=ControlsContainer] button[data-testid=previousButton]",
      mute: "div[class^=ControlsContainer] button[data-qa-id=volumeButton], div[class^=ControlsContainer] button[data-testid=volumeButton]",
      song: "title",
      buttonSwitch: true
    });

    controller.click = function(opts) {
      this.mousedown({ selectorButton: opts.selectorButton });
      this.mouseup({ selectorButton: opts.selectorButton });
    };
  });
})();
