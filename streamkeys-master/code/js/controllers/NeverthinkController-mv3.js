"use strict";
(function() {
  // MV3 compatible NeverthinkController

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
      siteName: "Neverthink",
      playState: ".PlayerControls-middleButtons",
      song: ".HiddenVideoTitle",
      album: ".VideoCreator-name",
      mute: ".PlayerControls-icon--mute",
      like: ".SaveVideoButton",
      overridePlayPause: true,
      overridePlayPrev: true,
      overridePlayNext: true
    });

    controller.showControls = function(){
      if(!document.querySelector(".PausePlayButton")){
        document.querySelector(".PlayerControls-mouseListenerLayer").dispatchEvent(new Event("mousemove", {bubbles: true}))
      }
    }
    controller.playPause = function(){
      this.showControls();
      document.querySelector(".PausePlayButton").click()
    }
    controller.playPrev = function(){
      this.showControls();
      document.querySelector(".PreviousVideoButton").click()
    }
    controller.playNext = function(){
      this.showControls();
      document.querySelector(".NextVideoButton").click()
    }
    controller.like = function(){
      this.showControls();
      var save_button = document.querySelector(".SaveVideoButton");

      save_button.click();

      // Dislike the video
      if(save_button.classList.contains("SaveVideoButton--saved")){
        setTimeout(function(){
          document.querySelector(".Popup-options>div").click()
        }, 100);
      }
    }
    controller.mute = function(){
      this.showControls();
      document.querySelector(".PlayerControls-icon--mute").click()
    }
    controller.isPlaying = function(){
      return !document.querySelector(".PausePlayButton") ? true : false;
    }
  });
})();
