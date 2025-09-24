"use strict";

/* eslint-disable no-unused-vars */

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
    // console.log("YouTube Controller initialized and ready for messages"); // DEBUG

    // Register controller globally so content script can access it
    window.streamkeysController = this;

    // Send a ready signal to background (optional)
    chrome.runtime.sendMessage({action: "controller_ready", siteName: this.siteName}, function() {
      if (chrome.runtime.lastError) {
                // console.log("Background not ready yet:", chrome.runtime.lastError.message); // DEBUG
      }
    });

    // Initialize state monitoring
    this.initStateMonitoring();
  };

  YouTubeController.prototype.initStateMonitoring = function() {
    var self = this;
    // console.log("Initializing state monitoring"); // DEBUG

    // Send initial state after page loads
    setTimeout(function() {
      // console.log("Sending initial state after 2s delay"); // DEBUG
      self.getPlayerState();
    }, 2000);

    // Debounced state update to prevent excessive calls
    var stateUpdateTimeout;
    var debounceStateUpdate = function(delay) {
      if (stateUpdateTimeout) clearTimeout(stateUpdateTimeout);
      stateUpdateTimeout = setTimeout(function() {
        // console.log("Debounced state update triggered"); // DEBUG
        self.getPlayerState();
      }, delay || 300);
    };

    // Listen for play/pause button clicks - but debounce to prevent spam
    document.addEventListener("click", function(e) {
      if (e.target.closest(self.selectors.playPause)) {
                // console.log("Play/pause button clicked in page, updating state"); // DEBUG

      // Detect YouTube page navigation
      let lastUrl = window.location.href;
      new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          // console.log("Page navigation detected, updating state"); // DEBUG
        // Only update after a short delay to let YouTube update
        debounceStateUpdate(500);
      }
    }, { passive: true });

    // Listen for navigation changes (when switching videos)
    window.addEventListener("popstate", function() {
      // console.log("Page navigation detected, updating state"); // DEBUG
      debounceStateUpdate(1000);
    }, { passive: true });

    // Reduced periodic state updates - matches MV2"s 200ms interval behavior (every 5 seconds instead of 10)
    setInterval(function() {
      // console.log("Periodic state update (5s interval)"); // DEBUG
      self.getPlayerState();
    }, 5000);
  };

  YouTubeController.prototype.getPlayerState = function() {
    // #!# // console.log("YouTube Controller: getPlayerState called");

    // Get current player state - improved detection for modern YouTube
    var playButton = document.querySelector(this.selectors.playPause);
    var isPlaying = false;

    if (playButton) {
      // Method 1: Check the aria-label attribute
      var ariaLabel = playButton.getAttribute("aria-label");
      // #!# // console.log("YouTube Controller: playButton aria-label:", ariaLabel);

      if (ariaLabel) {
        isPlaying = ariaLabel.toLowerCase().includes("pause");
      }

      // Method 2: Check title attribute as fallback
      if (!ariaLabel) {
        var title = playButton.getAttribute("title");
        // #!# // console.log("YouTube Controller: playButton title:", title);
        if (title) {
          isPlaying = title.toLowerCase().includes("pause");
        }
      }

      // Method 3: Check for play/pause icon classes
      if (!ariaLabel && !playButton.getAttribute("title")) {
        var playIcon = playButton.querySelector(".ytp-play-button");
        if (playIcon) {
          var style = window.getComputedStyle(playIcon);
          isPlaying = style.display === "none"; // Play icon hidden means video is playing
        }
      }

      // #!# // console.log("YouTube Controller: State detection - playButton found:", !!playButton, "isPlaying from button:", isPlaying);
    }

    // Method 4: Check the actual video element as a more reliable fallback
    var videoElement = document.querySelector("video");
    var videoIsPlaying = false;
    if (videoElement) {
      videoIsPlaying = !videoElement.paused;
      // #!# // console.log("YouTube Controller: Video element - paused:", videoElement.paused, "isPlaying from video:", videoIsPlaying);

      // If button and video disagree, prefer the video element state
      if (videoElement && isPlaying !== videoIsPlaying) {
        // #!# // console.log("YouTube Controller: Button and video state mismatch! Using video state:", videoIsPlaying);
        isPlaying = videoIsPlaying;
      }
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

    // #!# // console.log("YouTube Controller: Found elements - playButton:", !!playButton, "videoElement:", !!videoElement, "song:", song, "finalIsPlaying:", isPlaying);

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

    // console.log("YouTube Controller: Sending state to background:", state); // DEBUG

    // Send state update to background script
    try {
      chrome.runtime.sendMessage({
        action: "update_player_state",
        stateData: state
      }, function() {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message && chrome.runtime.lastError.message.includes("Extension context invalidated")) {
            // #!# // console.log("YouTube Controller: Extension was reloaded, stopping controller");
            return;
          }
          // #!# // console.log("YouTube Controller: Error sending state update:", chrome.runtime.lastError.message);
        } else {
          console.log("YouTube Controller: State update sent successfully");
        }
      });
    } catch (error) {
      if (error.message && error.message.includes("Extension context invalidated")) {
        // #!# // console.log("YouTube Controller: Extension was reloaded, stopping controller");
        return;
      }
      // #!# // console.log("YouTube Controller: Error in sendMessage:", error);
    }

    return state;
  };

  YouTubeController.prototype.handleAction = function(action) {
    // console.log("YouTube Controller handling action:", action);
    var self = this;

    switch(action) {
    case "playPause":
      // console.log("=== PLAY/PAUSE ACTION STARTED ===");

      // Remember the current state before clicking
      var stateBefore = this.getPlayerState();
      var wasPlaying = stateBefore ? stateBefore.isPlaying : false;
      // console.log("=== State before click: isPlaying =", wasPlaying, "===");

      // Click the button
      this.clickElement(this.selectors.playPause);

      // Send an immediate optimistic state update for faster UI response
      setTimeout(function() {
        // console.log("=== Optimistic state update for UI responsiveness ===");
        // Send optimistic state (opposite of what it was)
        var optimisticState = {
          siteName: self.siteName,
          song: stateBefore ? stateBefore.song : "",
          artist: stateBefore ? stateBefore.artist : "",
          isPlaying: !wasPlaying, // Flip the state optimistically
          canPlayPause: stateBefore ? stateBefore.canPlayPause : true,
          canPlayNext: stateBefore ? stateBefore.canPlayNext : false,
          canPlayPrev: stateBefore ? stateBefore.canPlayPrev : false,
          canLike: stateBefore ? stateBefore.canLike : false,
          canDislike: stateBefore ? stateBefore.canDislike : false
        };

        // console.log("=== Sending optimistic state:", optimisticState, "===");

        try {
          chrome.runtime.sendMessage({
            action: "update_player_state",
            stateData: optimisticState
          }, function() {
            if (chrome.runtime.lastError) {
              // console.log("YouTube Controller: Error sending optimistic state:", chrome.runtime.lastError.message);
            } else {
              // console.log("YouTube Controller: Optimistic state sent successfully");
            }
          });
        } catch (error) {
          // console.log("YouTube Controller: Error in optimistic sendMessage:", error);
        }
      }, 50);

      // Send multiple delayed state updates to catch when YouTube actually updates
      // FIXED: Reduced from 3 polling calls to 1 final check to prevent excessive logging
      setTimeout(function() {
        // console.log("=== Final state check after YouTube update ==="); // #!#
        self.getPlayerState();
        // console.log("=== PLAY/PAUSE ACTION COMPLETED ==="); // #!#
      }, 800); // Single check after YouTube has time to update
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
    // console.log("=== YouTube Controller Click Attempt ===");
    // console.log("Selector:", selector);

    // Special handling for YouTube play/pause
    if (selector === ".ytp-play-button") {
      return this.clickPlayPauseButton();
    }

    var element = document.querySelector(selector);
    if (element) {
      try {
        // console.log("Found element:", element);
        element.click();
        // console.log("Standard click executed");
      } catch (e) {
        // console.log("Standard click failed:", e);
      }
    } else {
      // console.log("Element not found:", selector);
    }
  };

  YouTubeController.prototype.clickPlayPauseButton = function() {
    // console.log("=== Specialized YouTube Play/Pause Click ===");

    // Method 1: Direct button clicking (most reliable for extensions)
    try {
      var button = document.querySelector(".ytp-play-button");
      if (button) {
        // console.log("Found play button, clicking directly...");
        button.click();
        // console.log("Direct button click executed");
        return true;
      }
    } catch (e) {
      // console.log("Direct button click failed:", e);
    }

    // Method 2: Keyboard shortcut as fallback
    try {
      // console.log("Fallback: Using keyboard shortcut method...");

      // Focus the video player first
      var player = document.querySelector("#movie_player") || document.querySelector("video");
      if (player) {
        player.focus();
        // console.log("Player focused");
      }

      // Use spacebar - YouTube"s primary play/pause shortcut
      var spaceEvent = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        keyCode: 32,
        bubbles: true,
        cancelable: true
      });

      document.dispatchEvent(spaceEvent);
      // console.log("Spacebar keydown dispatched");
      return true;

    } catch (e) {
      // console.log("Keyboard shortcut method failed:", e);
    }

    // console.log("All play/pause methods failed");
    return false;
  };

  YouTubeController.prototype.adjustVolume = function(change) {
    // YouTube volume adjustment would need more complex implementation
    // For now, just log the action
    // console.log("Volume adjustment:", change);
  };

  // Initialize controller when DOM is ready
  // console.log("YouTube Controller MV3 script loaded, DOM state:", document.readyState);

  // Prevent multiple instances
  if (window.streamkeysController) {
    // console.log("YouTube Controller already exists, skipping initialization");
    return;
  }

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function() {
        if (!window.streamkeysController) {
          // console.log("DOM loaded, initializing YouTube Controller...");
          new YouTubeController();
        }
      }, { passive: true });
    } else {
      // console.log("DOM already ready, initializing YouTube Controller immediately...");
      new YouTubeController();
    }
  } catch (error) {
    // console.error("YouTube Controller initialization failed:", error);
  }})();

