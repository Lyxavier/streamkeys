"use strict";

// YouTube Controller for Manifest V3
// Standalone controller without require() dependencies

(function() {
  // Basic controller implementation
  function YouTubeController() {
    this.siteName = "YouTube";
    this.selectors = {
      playPause: ".ytp-play-button",
      playNext: ".ytp-next-button",
      playPrev: ".ytp-prev-button",
      mute: ".ytp-mute-button",
      volumeBar: ".ytp-volume-slider-handle",
      progress: ".ytp-progress-bar"
    };

    this.init();
  }

  YouTubeController.prototype.init = function() {
    console.log("YouTube Controller initialized and ready for messages");

    // Register controller globally so content script can access it
    window.streamkeysController = this;

    // Send a ready signal to background (optional)
    chrome.runtime.sendMessage({action: "controller_ready", siteName: this.siteName}, function() {
      if (chrome.runtime.lastError) {
        console.log("Background not ready yet:", chrome.runtime.lastError.message);
      }
    });

    // Initialize state monitoring
    this.initStateMonitoring();
  };

  YouTubeController.prototype.initStateMonitoring = function() {
    var self = this;
    // Send initial state after page loads
    setTimeout(function() {
      self.getPlayerState();
    }, 2000);

    // Listen for play/pause button clicks
    document.addEventListener("click", function(e) {
      if (e.target.closest(self.selectors.playPause)) {
        setTimeout(function() {
          self.getPlayerState();
        }, 100);
      }
    }, { passive: true });

    // Listen for navigation changes (when switching videos)
    window.addEventListener("popstate", function() {
      setTimeout(function() {
        self.getPlayerState();
      }, 500);
    }, { passive: true });

    // Periodic state updates every 3 seconds
    setInterval(function() {
      self.getPlayerState();
    }, 3000);
  };

  YouTubeController.prototype.getPlayerState = function() {
    console.log("YouTube Controller: getPlayerState called");

    // Get current player state - using V2-style detection for better reliability
    var playButton = document.querySelector(this.selectors.playPause);
    var isPlaying = false;

    if (playButton) {
      // Use V2-style state detection: check if playState element exists and is visible
      var playStateEl = document.querySelector(".ytp-play-button[title^='Pause']");
      console.log("YouTube Controller: State detection - playButton found:", !!playButton, "playStateEl found:", !!playStateEl);
      if (playStateEl) {
        console.log("YouTube Controller: playStateEl title:", playStateEl.getAttribute("title"));
        console.log("YouTube Controller: playStateEl display:", window.getComputedStyle(playStateEl, null).getPropertyValue("display"));
      }
      isPlaying = !!(playStateEl && (window.getComputedStyle(playStateEl, null).getPropertyValue("display") !== "none"));
    }

    // Get song info - try multiple selectors for better compatibility
    var songElement = document.querySelector("#title h1.ytd-watch-metadata yt-formatted-string, #container h1.title, .title.ytd-video-primary-info-renderer, h1.title");
    var song = songElement ? songElement.textContent.trim() : "";

    // Fallback: try the modern YouTube title selector
    if (!song) {
      songElement = document.querySelector("h1.style-scope.ytd-watch-metadata");
      if (songElement) {
        song = songElement.textContent.trim();
      }
    }

    console.log("YouTube Controller: Found elements - playButton:", !!playButton, "songElement:", !!songElement, "song:", song, "isPlaying:", isPlaying);

    var state = {
      siteName: this.siteName,
      song: song,
      artist: "", // YouTube doesn't usually have separate artist field
      isPlaying: isPlaying,
      canPlayPause: !!playButton,
      canPlayNext: !!document.querySelector(this.selectors.playNext),
      canPlayPrev: !!document.querySelector(this.selectors.playPrev),
      canLike: !!document.querySelector("#menu ytd-toggle-button-renderer:first-child"),
      canDislike: !!document.querySelector("#menu ytd-toggle-button-renderer:nth-child(2)")
    };

    console.log("YouTube Controller: Sending state to background:", state);

    // Send state update to background script
    try {
      chrome.runtime.sendMessage({
        action: "update_player_state",
        stateData: state
      }, function() {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message && chrome.runtime.lastError.message.includes("Extension context invalidated")) {
            console.log("YouTube Controller: Extension was reloaded, stopping controller");
            return;
          }
          console.log("YouTube Controller: Error sending state update:", chrome.runtime.lastError.message);
        } else {
          console.log("YouTube Controller: State update sent successfully");
        }
      });
    } catch (error) {
      if (error.message && error.message.includes("Extension context invalidated")) {
        console.log("YouTube Controller: Extension was reloaded, stopping controller");
        return;
      }
      console.log("YouTube Controller: Error in sendMessage:", error);
    }

    return state;
  };

  YouTubeController.prototype.handleAction = function(action) {
    console.log("YouTube Controller handling action:", action);
    var self = this;

    switch(action) {
    case "playPause":
      this.clickElement(this.selectors.playPause);
      // Wait a bit for YouTube UI to update, then refresh state
      setTimeout(function() {
        self.getPlayerState();
      }, 200);
      break;
    case "playNext":
      this.clickElement(this.selectors.playNext);
      setTimeout(function() {
        self.getPlayerState();
      }, 500);
      break;
    case "playPrev":
      this.clickElement(this.selectors.playPrev);
      setTimeout(function() {
        self.getPlayerState();
      }, 500);
      break;
    case "like":
      this.clickElement("#menu > ytd-menu-renderer > #top-level-buttons > ytd-toggle-button-renderer:nth-child(1)");
      break;
    case "dislike":
      this.clickElement("#menu > ytd-menu-renderer > #top-level-buttons > ytd-toggle-button-renderer:nth-child(2)");
      break;
    case "mute":
      this.clickElement(this.selectors.mute);
      break;
    case "volumeUp":
      this.adjustVolume(0.1);
      break;
    case "volumeDown":
      this.adjustVolume(-0.1);
      break;
    }
  };

  YouTubeController.prototype.clickElement = function(selector) {
    var element = document.querySelector(selector);
    if (element) {
      element.click();
      console.log("Clicked element:", selector);
    } else {
      console.log("Element not found:", selector);
    }
  };

  YouTubeController.prototype.adjustVolume = function(change) {
    // YouTube volume adjustment would need more complex implementation
    // For now, just log the action
    console.log("Volume adjustment:", change);
  };

  // Initialize controller when DOM is ready
  console.log("YouTube Controller MV3 script loaded, DOM state:", document.readyState);

  // Prevent multiple instances
  if (window.streamkeysController) {
    console.log("YouTube Controller already exists, skipping initialization");
    return;
  }

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function() {
        if (!window.streamkeysController) {
          console.log("DOM loaded, initializing YouTube Controller...");
          new YouTubeController();
        }
      }, { passive: true });
    } else {
      console.log("DOM already ready, initializing YouTube Controller immediately...");
      new YouTubeController();
    }
  } catch (error) {
    console.error("YouTube Controller initialization failed:", error);
  }})();
