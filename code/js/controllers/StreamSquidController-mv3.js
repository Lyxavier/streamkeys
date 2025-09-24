"use strict";
(function() {
  // MV3 compatible StreamSquidController

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
      siteName: "streamsquid",
      play: "#player-play",
      pause: "#player-pause",
      playNext: "#player-next",
      playPrev: "#player-back",
      like: ".queue-item-selected #queue-item-fav-icon",
      playState: "#player-pause",
      // These are not selectors, but attribute names that the overridden getSongData uses
      // Because the attributes contain untruncated song and artist names (unlike the DOM Element text)
      song: "data-track-name",
      artist: "data-artist-name",
      // Yes, there is a typo in this id in the DOM
      currentTime: "#player-time-elpased",
      totalTime: "#player-duration"
    });

    controller.getSelectedQueueItem = function() {
      return this.doc().querySelector(".queue-item.queue-item-selected");
    };
    controller.getSongData = function(dataAttribute) {
      if(!dataAttribute) return null;

      var selectedItem = this.getSelectedQueueItem();
      if (selectedItem && selectedItem.attributes && selectedItem.attributes[dataAttribute]) {
        return selectedItem.attributes[dataAttribute].value;
      }

      return BaseController.prototype.getSongData.call(this, dataAttribute);
    };
    controller.getArtData = function() {
      var selectedItem = this.getSelectedQueueItem();

      if (selectedItem && selectedItem.attributes) {
        var youtubeIdAttribute = selectedItem.attributes["data-ytid"];
        var imageUrlAttribute = selectedItem.attributes["data-image-url"];
        if (imageUrlAttribute && imageUrlAttribute.value) {
        // imageUrlAttribute is sometimes a relative URL which we need to convert to an absolute URL to properly get art data
          return new URL(imageUrlAttribute.value, this.doc().location.protocol + "//" + this.doc().location.host).href;
        }
        else if (youtubeIdAttribute && youtubeIdAttribute.value) {
          return "https://img.youtube.com/vi/" + youtubeIdAttribute.value + "/default.jpg";
        }
      }

      return null;
    };
  });
})();
