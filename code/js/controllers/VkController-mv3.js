"use strict";
(function() {
  // MV3 compatible VkController (MouseEventController)

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
    let selectors;
    let controller;
    let vkObserver;

    // Simple mutation observer replacement
    function SimpleMutationObserver(doc) {
      this.doc = doc || document;
      this.observers = new Map();
    }

    SimpleMutationObserver.prototype.isEnabled = function(selector) {
      return !!this.doc.querySelector(selector);
    };

    SimpleMutationObserver.prototype.once = function(selector, action, callback) {
      if (action === "inserted") {
        const observer = new MutationObserver(() => {
          if (this.doc.querySelector(selector)) {
            observer.disconnect();
            callback();
          }
        });
        observer.observe(this.doc.body, { childList: true, subtree: true });
      }
    };

    // if new ui detected
    if (document.getElementById("top_notify_btn")) {
      console.log("[VK] New ui detected");

      selectors = {
        headerPlayer: "#top_audio_player",
        headerPlayerEnabled: "#top_audio_player.top_audio_player_enabled",
        headerPlayerIcon: "#top_audio",
        playerPanelPlay: ".audio_page_player_play"
      };

      controller = new MouseEventController({
        siteName: "VK Music",

        playPause: "#top_audio_player.top_audio_player_enabled .top_audio_player_play",
        playNext: "#top_audio_player.top_audio_player_enabled .top_audio_player_next",
        playPrev: "#top_audio_player.top_audio_player_enabled .top_audio_player_prev",

        playState: "#top_audio_player.top_audio_player_enabled.top_audio_player_playing",
        song: "#top_audio_player.top_audio_player_enabled .top_audio_player_title"
      });

      vkObserver = new SimpleMutationObserver(controller.doc());

      // overrides
      controller.playPause = function() {
        const self = this;

        // if player on header enabled call super and return
        if (vkObserver.isEnabled(selectors.headerPlayerEnabled)) {
          return MouseEventController.prototype.playPause.call(self);
        }
        // if play button enabled (e.g. current page its music) start playing and return
        if (vkObserver.isEnabled(selectors.playerPanelPlay)) {
          return self.click({ selectorButton: selectors.playerPanelPlay });
        }

        // listen when player initialized
        vkObserver.once(selectors.playerPanelPlay, "inserted", function() {
          self.click({ selectorButton: selectors.playerPanelPlay }); // start playing
          self.mousedown({ selectorButton: selectors.headerPlayer }); // hide player panel
        });

        // player initialization, click does not work
        // first need mouseover, and then mousedown
        self.mouseover({ selectorButton: selectors.headerPlayerIcon });
        self.mousedown({ selectorButton: selectors.headerPlayerIcon });
      };
    } else {
      // if new ui not detected
      console.log("[VK] New ui not detected");

      selectors = {
        headerPlayButton: "#head_play_btn",
        playerPanel: "#gp",
        playerPanelInfo: "#gp_info",
        playerPanelNext: "#pd_next",
        playerPanelPrev: "#pd_prev"
      };

      controller = new MouseEventController({
        siteName: "VK Music",
        playPause: "#gp_play",
        playNext: selectors.playerPanelNext,
        playPrev: selectors.playerPanelPrev,

        playState: "#gp_play.playing",
        artist: "#gp_performer",
        song: "#gp_title"
      });

      vkObserver = new SimpleMutationObserver(controller.doc());

      // click on initSelector, wait when waitSelector will be inserted,
      // click on waitSelector if needed and close player panel
      controller.initWaitAndClose = function(waitSelector, initSelector, clickOnWaitSelector) {
        const self = this;

        // default init player panel from header button
        waitSelector = waitSelector || selectors.playerPanelInfo;
        initSelector = initSelector || selectors.headerPlayButton;

        vkObserver.once(waitSelector, "inserted", function() {
          if (clickOnWaitSelector) {
            self.click({ selectorButton: waitSelector });
          }
          self.click({ selectorButton: selectors.playerPanelInfo }); // hide player
        });
        self.click({ selectorButton: initSelector });
      };

      // overrides
      controller.playPause = function() {
        const self = this;
        // if player panel enabled call super method and return
        if (vkObserver.isEnabled(selectors.playerPanel)) {
          return MouseEventController.prototype.playPause.call(self);
        }
        // initialize player panel
        self.initWaitAndClose();
      };

      controller.playNext = function() {
        const self = this;
        // if player panel already opened call super method and return
        if (vkObserver.isEnabled(selectors.playerPanelNext)) {
          return MouseEventController.prototype.playNext.call(self);
        }
        // open player panel, click next button, close player panel
        self.initWaitAndClose(selectors.playerPanelNext, selectors.playerPanelInfo, true);
      };

      controller.playPrev = function() {
        const self = this;
        // if player panel already opened call super method and return
        if (vkObserver.isEnabled(selectors.playerPanelPrev)) {
          return MouseEventController.prototype.playPrev.call(self);
        }
        // open player panel, click prev button, close player panel
        self.initWaitAndClose(selectors.playerPanelPrev, selectors.playerPanelInfo, true);
      };

      controller.getStateData = function() {
        const result = MouseEventController.prototype.getStateData.call(this); // call super
        // if player panel enabled activate prev/next buttons
        if (vkObserver.isEnabled(selectors.playerPanel)) {
          result.canPlayPrev = true;
          result.canPlayNext = true;
        }
        return result;
      };
    }
  });
})();
