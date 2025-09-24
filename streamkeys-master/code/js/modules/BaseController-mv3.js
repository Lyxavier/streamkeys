"use strict";
// MV3-compatible BaseController - Standalone version without require()
(function() {
  // Inline SKLog functionality for MV3 compatibility
  function sk_log(msg, obj, err) {
    if(msg) {
      obj = obj || "";
      if(err) {
        console.error("STREAMKEYS-ERROR: " + msg, obj);
      } else {
        console.log("STREAMKEYS-INFO: " + msg, obj);
      }
    }
  }
  function BaseController(options) {
    this.siteName = options.siteName || null;
    this.selectors = {
      //** Properties **//
      playPause: (options.playPause || null),
      play: (options.play || null),
      pause: (options.pause || null),
      playNext: (options.playNext || null),
      playPrev: (options.playPrev || null),
      mute: (options.mute || null),
      like: (options.like || null),
      confirmLike: (options.confirmLike || null),
      dislike: (options.dislike || null),
      confirmDislike: (options.confirmDislike || null),
      iframe: (options.iframe || null),
      //** States **//
      playState: (options.playState || null),
      //** Song Info **//
      song: (options.song || null),
      artist: (options.artist || null),
      album: (options.album || null),
      art: (options.art || null),
      currentTime: (options.currentTime || null),
      totalTime: (options.totalTime || null)
    };
    // Any property that's a function, turn it into a getter
    Object.defineProperties(
      this.selectors,
      Object.keys(this.selectors)
        .reduce(function(properties, key) {
          var fn = this.selectors[key];
          if (typeof fn === "function") {
            properties[key] = {
              get: fn.bind(this)
            };
          }
          return properties;
        }.bind(this), {}));
    // Previous player state, used to check vs current player state to see if anything changed
    this.oldState = {};
    // Set to true if the play/pause buttons share the same element
    this.buttonSwitch = options.buttonSwitch || false;
    // Default listener sends actions to main document
    this.attachListeners();
    // Expose controller globally for content script verification (MV3 requirement)
    window.streamkeysController = this;
    // Set to true if the tab should be hidden from the popup unless it has a playPause element shown
    this.hidePlayer = options.hidePlayer || false;
    //** Overrides for popup buttons **//
    this.overridePlayPrev = options.overridePlayPrev || false;
    this.overridePlayPause = options.overridePlayPause || false;
    this.overridePlayNext = options.overridePlayNext || false;
    // Send creation message to background script
    try {
      chrome.runtime.sendMessage({ created: true }, function() {
        if (chrome.runtime.lastError) {
          // Extension context invalidated - normal during service worker restart
          sk_log("Background script unavailable during initialization: " + chrome.runtime.lastError.message);
        } else {
          sk_log("SK content script loaded");
        }
      });
    } catch (error) {
      sk_log("Error sending creation message", error, true);
    }
  }
  BaseController.prototype.doc = function() {
    var returnDoc = document;
    if (this.selectors.iframe) {
      if (document.querySelector(this.selectors.iframe)) {
        if (document.querySelector(this.selectors.iframe).tagName.indexOf("FRAME") > -1) {
          returnDoc = document.querySelector(this.selectors.iframe).contentWindow.document;
        }
      }
    }
    return returnDoc;
  };
  /**
   * Inject a script into the current document
   * @param {String} file.url - /relative/path/to/script
   * @param {String} file.script - plaintext script as a string
   */
  BaseController.prototype.injectScript = function(file) {
    var script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    if(file.url) {script.setAttribute("src", chrome.runtime.getURL(file.url));}
    if(file.script) {script.innerHTML = file.script;}
    (document.head || document.documentElement).appendChild(script);
  };
  BaseController.prototype.attachListeners = function() {
    this.listener = function(e) {
      this.onCommand(e.detail);
    }.bind(this);
    document.addEventListener("streamkeys-cmd", this.listener);
    // MV3 improvement: Use MutationObserver to send periodic state updates
    this.setupStateMonitoring();
  };
  BaseController.prototype.onCommand = function(command) {
    sk_log("Command received: " + command);
    switch(command) {
    case "playPause":
      this.playPause();
      break;
    case "playNext":
      this.playNext();
      break;
    case "playPrev":
      this.playPrev();
      break;
    case "like":
      this.like();
      break;
    case "dislike":
      this.dislike();
      break;
    case "mute":
      this.mute();
      break;
    case "stop":
      this.stop();
      break;
    }
  };
  BaseController.prototype.setupStateMonitoring = function() {
    var self = this;
    // Send initial state
    setTimeout(function() {
      self.getPlayerState();
    }, 1000);
    // Set up periodic state updates (faster polling for real-time feel)
    setInterval(function() {
      self.getPlayerState();
    }, 500); // 500ms polling (balance between responsiveness and performance)
    // Listen for DOM changes that might affect player state (with throttling)
    if (typeof MutationObserver !== "undefined") {
      var mutationTimeout;
      var observer = new MutationObserver(function() {
        // Throttle DOM change updates to avoid excessive calls
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(function() {
          self.getPlayerState();
        }, 100);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "aria-label", "title", "data-playing", "data-state"]
      });
    }
  };
  BaseController.prototype.click = function(selector) {
    var element = this.doc().querySelector(selector);
    if (element) {
      var clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(clickEvent);
      return true;
    }
    return false;
  };
  BaseController.prototype.playPause = function() {
    var element = null;
    if (this.buttonSwitch) {
      element = this.doc().querySelector(this.selectors.playPause);
    } else {
      if (this.isPlaying()) {
        element = this.doc().querySelector(this.selectors.pause);
      } else {
        element = this.doc().querySelector(this.selectors.play);
      }
    }
    if (element) {
      this.click(this.selectors.playPause || this.selectors.play || this.selectors.pause);
    }
  };
  BaseController.prototype.playNext = function() {
    this.click(this.selectors.playNext);
  };
  BaseController.prototype.playPrev = function() {
    this.click(this.selectors.playPrev);
  };
  BaseController.prototype.like = function() {
    this.click(this.selectors.like);
  };
  BaseController.prototype.dislike = function() {
    this.click(this.selectors.dislike);
  };
  BaseController.prototype.mute = function() {
    this.click(this.selectors.mute);
  };
  BaseController.prototype.stop = function() {
    // Most sites don't have a stop button, just pause
    if (this.isPlaying()) {
      this.playPause();
    }
  };
  BaseController.prototype.isPlaying = function() {
    var playElement = this.doc().querySelector(this.selectors.play);
    var pauseElement = this.doc().querySelector(this.selectors.pause);
    if (this.buttonSwitch) {
      var element = this.doc().querySelector(this.selectors.playPause);
      if (element) {
        var ariaLabel = element.getAttribute("aria-label") || "";
        var title = element.getAttribute("title") || "";
        return ariaLabel.toLowerCase().includes("pause") || title.toLowerCase().includes("pause");
      }
    } else {
      // If we have separate play/pause buttons, check visibility
      if (playElement && pauseElement) {
        var playStyle = window.getComputedStyle(playElement);
        var pauseStyle = window.getComputedStyle(pauseElement);
        return pauseStyle.display !== "none" && playStyle.display === "none";
      }
    }
    // Fallback: check for play state selector
    if (this.selectors.playState) {
      var stateElement = this.doc().querySelector(this.selectors.playState);
      if (stateElement) {
        return stateElement.classList.contains("playing") ||
               stateElement.classList.contains("play") ||
               stateElement.getAttribute("data-state") === "playing";
      }
    }
    return false;
  };
  BaseController.prototype.getSongInfo = function() {
    var song = "";
    var artist = "";
    var album = "";
    if (this.selectors.song) {
      var songElement = this.doc().querySelector(this.selectors.song);
      if (songElement) {
        song = songElement.textContent.trim();
      }
    }
    if (this.selectors.artist) {
      var artistElement = this.doc().querySelector(this.selectors.artist);
      if (artistElement) {
        artist = artistElement.textContent.trim();
      }
    }
    if (this.selectors.album) {
      var albumElement = this.doc().querySelector(this.selectors.album);
      if (albumElement) {
        album = albumElement.textContent.trim();
      }
    }
    return {
      song: song,
      artist: artist,
      album: album
    };
  };
  BaseController.prototype.getPlayerState = function() {
    var songInfo = this.getSongInfo();
    var isPlaying = this.isPlaying();
    var state = {
      siteName: this.siteName,
      song: songInfo.song,
      artist: songInfo.artist,
      album: songInfo.album,
      isPlaying: isPlaying,
      canPlayPause: !!this.doc().querySelector(this.selectors.playPause || this.selectors.play || this.selectors.pause),
      canPlayNext: !!this.doc().querySelector(this.selectors.playNext),
      canPlayPrev: !!this.doc().querySelector(this.selectors.playPrev),
      canLike: !!this.doc().querySelector(this.selectors.like),
      canDislike: !!this.doc().querySelector(this.selectors.dislike)
    };
    // Only send update if state has changed
    var stateChanged = JSON.stringify(state) !== JSON.stringify(this.oldState);
    if (stateChanged) {
      this.oldState = state;
      try {
        chrome.runtime.sendMessage({
          action: "update_player_state",
          stateData: state
        });
      } catch (error) {
        sk_log("Error sending state update", error, true);
      }
    }
    return state;
  };
  BaseController.prototype.handleAction = function(action) {
    this.onCommand(action);
  };
  // Make BaseController available globally
  window.BaseController = BaseController;
})();
