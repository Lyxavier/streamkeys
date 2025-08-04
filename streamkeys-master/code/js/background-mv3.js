"use strict";

// Service Worker for Streamkeys Extension (Manifest V3)
// #!# console.log("Streamkeys MV3 Service Worker starting...");

// Import required modules using importScripts (MV3 compatible)
try {
  importScripts("sites-mv3.js");
  // #!# console.log("Streamkeys: sites-mv3.js imported successfully");
} catch (error) {
  // #!# console.error("Streamkeys: Error importing sites-mv3.js:", error);
}

/**
 * Map from tab.id to it's status and time when it was updated
 * e.g. tabStates = {"787" : {"timestamp": <epoch>, "state": <state>}, ...}
 * Look ./modules/BaseController.js getStateData method for what is state.
 */
var tabStates = {};

/**
 * Global variables for service worker context
 */
var skSites = null;

// Initialize when service worker starts
chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onInstalled.addListener(initialize);

function initialize() {
  // #!# console.log("Streamkeys: Initializing service worker...");
  // #!# console.log("Streamkeys: Checking for STREAMKEYS_SITES...");

  // Debug: Check what's available
  // #!# console.log("Streamkeys: typeof STREAMKEYS_SITES:", typeof STREAMKEYS_SITES);
  // #!# console.log("Streamkeys: typeof self.STREAMKEYS_SITES:", typeof self.STREAMKEYS_SITES);

  try {
    // Sites list is available from sites-mv3.js as STREAMKEYS_SITES
    // Check both global scope and self scope for service worker compatibility
    const sites = (typeof STREAMKEYS_SITES !== "undefined") ? STREAMKEYS_SITES :
      (typeof self.STREAMKEYS_SITES !== "undefined") ? self.STREAMKEYS_SITES : null;

    if (sites) {
      // Create a simple sites interface
      skSites = {
        getActiveMusicTabs: function() {
          return new Promise((resolve, reject) => {
            chrome.tabs.query({}, (allTabs) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }

              const musicTabs = allTabs.filter(tab => {
                if (!tab.url) return false;
                return Object.values(sites).some(site => {
                  if (!site.url) return false;
                  const siteUrl = site.url.replace(/^https?:\/\//, "");
                  return tab.url.includes(siteUrl) ||
                         tab.url.includes(siteUrl.replace("www.", ""));
                });
              });

              resolve(musicTabs);
            });
          });
        },

        getDisabledMusicTabs: function() {
          return new Promise((resolve) => {
            // For now, return empty array - this can be enhanced later
            resolve([]);
          });
        },

        getController: function(url) {
          if (!url) return null;

          // Find matching site and return controller filename
          for (const siteKey in sites) {
            const site = sites[siteKey];
            if (!site.url) continue;

            const siteUrl = site.url.replace(/^https?:\/\//, "");
            if (url.includes(siteUrl) || url.includes(siteUrl.replace("www.", ""))) {
              const controllerFile = site.controller || (siteKey + "Controller.js");
              return `js/controllers/${controllerFile}`;
            }
          }
          return null;
        }
      };
      // #!# console.log("Streamkeys: Sites interface created successfully with", Object.keys(sites).length, "sites");
    } else {
      // #!# console.error("Streamkeys: STREAMKEYS_SITES not available - sites list is null/undefined");
      // Retry initialization after a short delay
      setTimeout(() => {
        // #!# console.log("Streamkeys: Retrying initialization...");
        initialize();
      }, 1000);
    }
  } catch (error) {
    // #!# console.error("Streamkeys: Error initializing service worker:", error);
  }
}

// Initialize immediately
initialize();

/**
 * Send a player action to every active player tab if it's state command
 * or "stop"-like command. Otherwise command target depends on
 * "single player mode" option.
 * @param {String} command - name of the command to pass to the players
 */
var sendAction = function(command) {
  console.log("Streamkeys: sendAction called with:", command); // #!# DEBUG - remove when fixed
  if (!skSites) {
    // #!# console.log("STREAMKEYS-INFO: Background not fully initialized yet, skipping action:", command);
    return;
  }

  skSites.getActiveMusicTabs().then(function(tabs) {
    if (command === "mute" ||
        command === "stop" ||
        command === "playerStateNotify" ||
        command === "getPlayerState") {
      sendActionAllPlayers(command, tabs);
      return;
    }

    chrome.storage.sync.get(function(obj) {
      if (Object.prototype.hasOwnProperty.call(obj,"hotkey-single_player_mode") &&
          obj["hotkey-single_player_mode"]) {
        sendActionSinglePlayer(command, tabs);
      } else {
        sendActionAllPlayers(command, tabs);
      }
    });
  }).catch(error => {
    console.error("Streamkeys: Error getting active music tabs:", error);
  });
};

/**
 * For "single player mode": if any tabs are playing - sends
 * action to all (as it's not clear which one to prefer)
 * otherwise tries to select best tab to interact with.
 */
var sendActionSinglePlayer = function(command, tabs) {
  if (!tabs || tabs.length === 0) return;
  var playing = getPlayingTabs(tabs);
  if (playing.length === 0) {
    sendActionAllPlayers(command, [getBestSinglePlayerTab(tabs)]);
  } else {
    sendActionAllPlayers(command, playing);
  }
};

/**
 * Returns "best" tab:
 * - if there is one tab is updated 200ms after all others
 * - otherwise active tab
 * - otherwise most recently updated
 */
var getBestSinglePlayerTab = function(tabs) {
  var times = tabs.map(getTabUpdateTime);
  var maxTimestamp = Math.max(...times);

  // Pick tabs within 200ms from the most recent one.
  tabs = tabs.filter(function(tab) {
    return maxTimestamp - getTabUpdateTime(tab) < 200;
  });

  var sorted = tabs.sort((a, b) => {
    if (a.active !== b.active) return a.active ? 1 : -1;
    return getTabUpdateTime(a) - getTabUpdateTime(b);
  });

  return sorted[sorted.length - 1];
};

var getTabUpdateTime = function(tab) {
  if (Object.prototype.hasOwnProperty.call(tabStates, tab.id)) {
    return tabStates[tab.id].timestamp;
  }
  return 0;
};

/**
 * Filters out tabs that has not reported 'isPlaying' status.
 */
var getPlayingTabs = function(tabs) {
  return tabs.filter(function(tab) {
    return Object.prototype.hasOwnProperty.call(tabStates, tab.id) &&
           Object.prototype.hasOwnProperty.call(tabStates[tab.id], "state") &&
           Object.prototype.hasOwnProperty.call(tabStates[tab.id].state, "isPlaying") &&
           tabStates[tab.id].state.isPlaying;
  });
};

/**
 * Send action to all provided tabs
 */
var sendActionAllPlayers = function(command, tabs) {
  tabs.forEach(function(tab) {
    chrome.tabs.sendMessage(tab.id, { action: command }, function() {
      if (chrome.runtime.lastError) {
        console.log("Streamkeys: Could not send message to tab", tab.id, ":", chrome.runtime.lastError.message);
      }
    });
  });
};

/**
 * Message handler for popup and content script communication
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // #!# console.log("Streamkeys: Received message:", request);

  try {
    if (request.action === "get_music_tabs") {
      if (!skSites) {
        console.warn("Streamkeys: Sites not initialized, returning empty result");
        sendResponse({ enabled: [], disabled: [] });
        return true;
      }

      skSites.getActiveMusicTabs().then(enabled => {
        skSites.getDisabledMusicTabs().then(disabled => {
          sendResponse({ enabled: enabled || [], disabled: disabled || [] });
        }).catch(error => {
          console.error("Streamkeys: Error getting disabled tabs:", error);
          sendResponse({ enabled: enabled || [], disabled: [] });
        });
      }).catch(error => {
        console.error("Streamkeys: Error getting enabled tabs:", error);
        sendResponse({ enabled: [], disabled: [] });
      });

      return true; // Async response
    }

    if (request.action === "get_site_controller") {
      if (!skSites || !sender.tab || !sender.tab.url) {
        sendResponse(null);
        return;
      }

      // Get controller filename for the site
      const controller = skSites.getController(sender.tab.url);
      sendResponse(controller);
      return;
    }

    if (request.action === "inject_controller") {
      // #!# console.log("Streamkeys: Inject:", request.file, "into tab:", sender.tab.id);
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        files: [request.file]
      }, function() {
        if (chrome.runtime.lastError) {
          console.error("Streamkeys: Error executing script:", chrome.runtime.lastError.message);
          sendResponse({success: false, error: chrome.runtime.lastError.message});
        } else {
          // #!# console.log("Streamkeys: Script injected successfully");
          sendResponse({success: true});
        }
      });
      return true; // Async response
    }

    if (request.action === "command" && request.command) {
      // #!# console.log("Streamkeys: Processing command:", request.command, "for tab:", request.tab_target);
      if (request.tab_target) {
        // Send command to specific tab
        chrome.tabs.sendMessage(request.tab_target, { action: request.command }, function() {
          if (chrome.runtime.lastError) {
            console.log("Streamkeys: Error sending command to tab:", chrome.runtime.lastError.message);
          }
        });
      } else {
        // Send command to all music tabs
        sendAction(request.command);
      }
      sendResponse({ success: true });
      return;
    }

    if (request.action && typeof sendAction === "function") {
      sendAction(request.action);
      sendResponse({ success: true });
      return;
    }

    // Handle tab state updates from content scripts
    if (request.playerState && sender.tab) {
      tabStates[sender.tab.id] = {
        timestamp: Date.now(),
        state: request.playerState
      };

      // Notify popup of state change if needed
      chrome.runtime.sendMessage({
        action: "playerStateUpdate",
        tabId: sender.tab.id,
        state: request.playerState
      }).catch(() => {
        // Popup may not be open, ignore errors
      });

      sendResponse({ received: true });
      return;
    }

    console.warn("Streamkeys: Unhandled message:", request);
    sendResponse({ error: "Unknown action" });

  } catch (error) {
    console.error("Streamkeys: Error handling message:", error);
    sendResponse({ error: error.message });
  }
});

/**
 * Command handler for keyboard shortcuts
 */
chrome.commands.onCommand.addListener(function(command) {
  console.log("Streamkeys: Command received:", command); // #!# DEBUG - remove when fixed
  sendAction(command);
});

/**
 * Tab removal handler - clean up state
 */
chrome.tabs.onRemoved.addListener(function(tabId) {
  if (tabStates[tabId]) {
    delete tabStates[tabId];
    console.log("Streamkeys: Cleaned up state for closed tab:", tabId);
  }
});

/**
 * Extension context invalidated handler
 */
chrome.runtime.onConnect.addListener(function(port) {
  port.onDisconnect.addListener(function() {
    if (chrome.runtime.lastError) {
      console.log("Streamkeys: Port disconnected:", chrome.runtime.lastError.message);
    }
  });
});

// #!# console.log("Streamkeys MV3 Service Worker loaded successfully");
