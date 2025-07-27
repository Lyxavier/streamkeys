"use strict";

// Service Worker for Streamkeys Extension (Manifest V3)
// Keep service worker alive for better message handling
chrome.runtime.onStartup.addListener(() => {
  console.log("Service worker startup");
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Service worker installed");
});

// Prevent service worker from going to sleep during critical operations
var keepAliveTimeout;
function keepServiceWorkerAlive() {
  if (keepAliveTimeout) clearTimeout(keepAliveTimeout);
  keepAliveTimeout = setTimeout(() => {
    // Simple operation to keep worker alive
    chrome.runtime.getPlatformInfo(() => {
      console.log("Service worker keep-alive ping");
    });
    keepServiceWorkerAlive();
  }, 25000); // Chrome allows 30 seconds, we'll ping every 25
}

// Start keep-alive mechanism
keepServiceWorkerAlive();

// Import site list and utilities
try {
  importScripts("./sites-mv3.js");
  console.log("Background script loaded, STREAMKEYS_SITES available:", typeof STREAMKEYS_SITES !== "undefined");
  if (typeof STREAMKEYS_SITES !== "undefined") {
    console.log("Sites count:", Object.keys(STREAMKEYS_SITES).length);
    console.log("Sample sites:", Object.keys(STREAMKEYS_SITES).slice(0, 5));
  }
} catch (error) {
  console.error("Failed to import sites-mv3.js:", error);
}

// Simple lodash-like utilities for MV3
var _ = {
  isEmpty: function(obj) {
    return !obj || (Array.isArray(obj) ? obj.length === 0 : Object.keys(obj).length === 0);
  },
  map: function(arr, fn) {
    return arr.map(fn);
  },
  max: function(arr) {
    return Math.max.apply(Math, arr);
  },
  filter: function(arr, fn) {
    return arr.filter(fn);
  },
  sortBy: function(arr, keys) {
    return arr.sort(function(a, b) {
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var aVal = typeof key === "function" ? key(a) : a[key];
        var bVal = typeof key === "function" ? key(b) : b[key];
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
      }
      return 0;
    });
  },
  last: function(arr) {
    return arr[arr.length - 1];
  },
  forEach: function(obj, fn) {
    if (Array.isArray(obj)) {
      obj.forEach(fn);
    } else {
      Object.keys(obj).forEach(function(key) {
        return fn(obj[key], key);
      });
    }
  }
};

// MV3 Site list functionality (simplified version of Sitelist.js)
var skSites = {
  sites: STREAMKEYS_SITES,

  getActiveMusicTabs: function() {
    console.log("getActiveMusicTabs called, sites available:", !!this.sites);
    var self = this;
    return new Promise(function(resolve) {
      chrome.tabs.query({}, function(tabs) {
        console.log("Found total tabs:", tabs.length);
        var musicTabs = tabs.filter(function(tab) {
          if (!tab.url) {
            console.log("Tab has no URL:", tab.id);
            return false;
          }
          var isMusic = self.checkMusicSite(tab.url) !== "no_inject";
          var isEnabled = self.checkTabEnabled(tab.id);
          if (isMusic) {
            console.log("Found music site:", tab.url, "enabled:", isEnabled);
          }
          return isMusic && isEnabled;
        });
        console.log("Filtered active music tabs:", musicTabs.length);
        resolve(musicTabs);
      });
    });
  },

  getMusicTabs: function() {
    console.log("getMusicTabs called");
    var self = this;
    return new Promise(function(resolve) {
      chrome.tabs.query({}, function(tabs) {
        console.log("Found total tabs:", tabs.length);
        var enabledTabs = [];
        var disabledTabs = [];

        tabs.forEach(function(tab) {
          if (!tab.url) return;

          var isMusicSite = self.checkMusicSite(tab.url) !== "no_inject";
          if (isMusicSite) {
            var siteKey = self.getSitelistName(tab.url);
            if (siteKey) {
              tab.streamkeysSiteKey = siteKey;
              tab.streamkeysPriority = self.getPriority(siteKey);
              tab.streamkeysEnabled = self.checkTabEnabled(tab.id);

              if (tab.streamkeysEnabled) {
                enabledTabs.push(tab);
              } else {
                disabledTabs.push(tab);
              }
            }
          }
        });

        console.log("Enabled tabs:", enabledTabs.length, "Disabled tabs:", disabledTabs.length);
        resolve({
          enabled: enabledTabs,
          disabled: disabledTabs
        });
      });
    });
  },

  checkMusicSite: function(url) {
    if (!url) {
      console.log("checkMusicSite: No URL provided");
      return "no_inject";
    }

    if (!this.sites) {
      console.log("checkMusicSite: No sites data available");
      return "no_inject";
    }

    console.log("checkMusicSite checking URL:", url);
    for (var siteKey in this.sites) {
      var site = this.sites[siteKey];
      if (!site || !site.url) {
        console.log("checkMusicSite: Skipping site with missing data:", siteKey, site);
        continue; // Skip if site or site.url is null/undefined
      }

      if (url.includes(siteKey) || url.includes(site.url.replace(/https?:\/\//, ""))) {
        console.log("checkMusicSite: Found match for", siteKey);
        return "inject";
      }
    }
    console.log("checkMusicSite: No match found for", url);
    return "no_inject";
  },

  getController: function(url) {
    if (!url) return null;

    for (var siteKey in this.sites) {
      var site = this.sites[siteKey];
      if (!site || !site.url) continue; // Skip if site or site.url is null/undefined

      if (url.includes(siteKey) || url.includes(site.url.replace(/https?:\/\//, ""))) {
        return site.controller;
      }
    }
    return null;
  },

  getSitelistName: function(url) {
    if (!url) return null;

    for (var siteKey in this.sites) {
      var site = this.sites[siteKey];
      if (!site || !site.url) continue;

      if (url.includes(siteKey) || url.includes(site.url.replace(/https?:\/\//, ""))) {
        return siteKey;
      }
    }
    return null;
  },

  getPriority: function(siteKey) {
    // This will be loaded from storage, but for now return default
    // In V2, this comes from chrome.storage.sync["hotkey-sites"][siteKey].priority
    return (this.siteSettings[siteKey] && this.siteSettings[siteKey].priority) || 1;
  },

  // Storage for site settings (priority, enabled state, etc.)
  siteSettings: {},

  loadSettings: function() {
    var self = this;
    return new Promise(function(resolve) {
      chrome.storage.sync.get("hotkey-sites", function(obj) {
        if (obj["hotkey-sites"]) {
          self.siteSettings = obj["hotkey-sites"];
        } else {
          // Initialize default settings for all sites
          self.siteSettings = {};
          Object.keys(self.sites).forEach(function(siteKey) {
            self.siteSettings[siteKey] = {
              enabled: true,
              priority: 1,
              showNotifications: false
            };
          });
          chrome.storage.sync.set({ "hotkey-sites": self.siteSettings });
        }
        resolve();
      });
    });
  },

  setPriority: function(siteKey, priority) {
    if (!this.siteSettings[siteKey]) {
      this.siteSettings[siteKey] = { enabled: true, priority: 1, showNotifications: false };
    }
    this.siteSettings[siteKey].priority = priority;

    // Save to storage
    chrome.storage.sync.set({ "hotkey-sites": this.siteSettings });

    // Update all tabs with this site
    var self = this;
    return new Promise(function(resolve) {
      self.getMusicTabs().then(function(tabs) {
        var allTabs = tabs.enabled.concat(tabs.disabled);
        allTabs.forEach(function(tab) {
          if (tab.streamkeysSiteKey === siteKey) {
            tab.streamkeysPriority = priority;
          }
        });
        resolve();
      });
    });
  },

  checkShowNotifications: function() {
    // Simplified - always allow notifications for now
    return true;
  },

  // Store for temporarily disabled tabs
  disabledTabs: [],

  checkTabEnabled: function(tabId) {
    return (tabId && this.disabledTabs.indexOf(parseInt(tabId)) === -1);
  },

  markTabEnabledState: function(tabId, enabled) {
    tabId = parseInt(tabId);
    if (enabled) {
      this.disabledTabs = this.disabledTabs.filter(function(tab) {
        return tab !== tabId;
      });
    } else {
      if (this.disabledTabs.indexOf(tabId) === -1) {
        this.disabledTabs.push(tabId);
      }
    }
  },

  setSiteState: function(siteKey, siteState) {
    return new Promise(function(resolve) {
      var storageObj = {};
      storageObj["site_" + siteKey] = siteState;
      chrome.storage.sync.set(storageObj, function() {
        resolve();
      });
    });
  }
};

// Global reference for compatibility
self.skSites = skSites;

// Global commands storage
var coms = null;

/**
   * Tracks TimeoutIds by notification ID, to cancel previous uncomplete Timeouts
   * when a new notification is created prior to the last notification clearing
   */
var notificationTimeouts = {};

/**
   * Map from tab.id to it's status and time when it was updated
   * e.g. tabStates = {"787" : {"timestamp": <epoch>, "state": <state>}, ...}
   * Look ./modules/BaseController.js getStateData method for what is state.
   */
var tabStates = {};

/**
   * Send a player action to every active player tab if it's state command
   * or "stop"-like command. Otherwise command target depends on
   * "single player mode" option.
   * @param {String} command - name of the command to pass to the players
   */
var sendAction = function(command) {
  console.log("*** SEND ACTION CALLED:", command);
  var active_tabs = skSites.getActiveMusicTabs();
  active_tabs.then(function(tabs) {
    console.log("*** ACTIVE MUSIC TABS FOUND:", tabs.length);
    if (command === "mute" ||
          command === "stop" ||
          command === "playerStateNotify" ||
          command === "getPlayerState") {
      console.log("*** SENDING TO ALL PLAYERS:", command);
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
  });
};

/**
   * For "single player mode": if any tabs are playing - sends
   * action to all (as it's not clear which one to prefer)
   * otherwise tries to select best tab to interact with.
   */
var sendActionSinglePlayer = function(command, tabs) {
  if (_.isEmpty(tabs)) return;
  var playing = getPlayingTabs(tabs);
  if (_.isEmpty(playing)) {
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
  var times = _.map(tabs, getTabUpdateTime);
  var maxTimestamp = _.max(times);
  // Pick tabs within 200ms from the most recent one.
  tabs = _.filter(tabs, function(tab) {
    return maxTimestamp - getTabUpdateTime(tab) < 200;
  });
  var sorted = _.sortBy(tabs, ["active", getTabUpdateTime]);
  return _.last(sorted);
};

var getTabUpdateTime = function(tab) {
  if (Object.prototype.hasOwnProperty.call(tabStates,tab.id)) {
    return tabStates[tab.id].timestamp;
  }
  return 0;
};

/**
   * Filters out tabs that has not reported 'isPlaying' status.
   */
var getPlayingTabs = function(tabs) {
  return _.filter(tabs, function(tab) {
    return Object.prototype.hasOwnProperty.call(tabStates,tab.id) &&
        tabStates[tab.id].state.isPlaying;
  });
};

/**
   * Sends command to every tab in the list.
   */
var sendActionAllPlayers = function(command, tabs) {
  console.log("*** SEND ACTION ALL PLAYERS:", command, "to", tabs.length, "tabs");
  tabs.forEach(function(tab) {
    console.log("*** SENDING", command, "to tab", tab.id, tab.url);
    chrome.tabs.sendMessage(tab.id, { "action": command }, function() {
      if (chrome.runtime.lastError) {
        console.log("Could not send command to tab", tab.id, ":", chrome.runtime.lastError.message);
      } else {
        console.log("Sent: " + command + " To: " + tab.url);
      }
    });
  });
};

/**
   * Process a command sent from somewhere (popup or content script) in the extension
   * @param {Object} request - Chrome request object from runtime.onMessage
   */
var processCommand = function(request) {
  if (request.command === "toggleEnabled" && request.tab_target) {
    var tabId = parseInt(request.tab_target);
    var currentlyEnabled = skSites.checkTabEnabled(tabId);
    skSites.markTabEnabledState(tabId, !currentlyEnabled);
    console.log("Toggled tab", tabId, "enabled state to:", !currentlyEnabled);
    return;
  }

  if (request.command === "setPriority" && request.tab_target && request.priority) {
    var priorityTabId = parseInt(request.tab_target);
    chrome.tabs.get(priorityTabId, function(tab) {
      if (tab && tab.url) {
        var siteKey = skSites.getSitelistName(tab.url);
        if (siteKey) {
          skSites.setPriority(siteKey, parseInt(request.priority)).then(function() {
            console.log("Set priority for", siteKey, "to", request.priority);
          });
        }
      }
    });
    return;
  }

  if(request.tab_target && parseInt(request.tab_target)) {
    chrome.tabs.sendMessage(parseInt(request.tab_target), { "action": request.command }, function() {
      if (chrome.runtime.lastError) {
        console.log("Could not send command to tab", request.tab_target, ":", chrome.runtime.lastError.message);
      } else {
        console.log("Single tab request. Sent: " + request.command + " To: " + request.tab_target);
      }
    });
  } else {
    sendAction(request.command);
  }
};

/**
   * Capture hotkeys and send their actions to tab(s) with music player running
   */
chrome.commands.onCommand.addListener(function(command) {
  console.log("*** MEDIA KEY COMMAND RECEIVED:", command);
  sendAction(command);
});

/**
   * Messages sent from Options page
   */
chrome.runtime.onMessage.addListener(function(request, sender, response) {
  console.log("Background received message:", request.action, "from tab:", sender.tab && sender.tab.id, sender.tab && sender.tab.url);

  if(request.action === "update_keys") {
    skSites.loadSettings();
    return true;
  }
  if(request.action === "update_site_settings") {
    console.log("updating site settings: ", request.siteKey, request.siteState);
    skSites.setSiteState(request.siteKey, request.siteState).then(function() {
      response(true);
    });
    return true;
  }
  if(request.action === "get_sites") {
    response(skSites.sites);
    return true;
  }
  if(request.action === "get_site_controller") {
    response(skSites.getController(sender.tab.url));
    return true;
  }
  if(request.action === "inject_controller") {
    console.log("Inject: " + request.file + " into: " + sender.tab.id);
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: [request.file]
    }).then(function() {
      console.log("Controller injection successful:", request.file);
      response({success: true, message: "Controller injected successfully"});
    }).catch(function(error) {
      console.error("Controller injection failed:", error);
      response({success: false, error: error.message});
    });
    if (mprisPort) mprisPort.postMessage({ command: "add_player" });
    return true; // Keep channel open for async response
  }
  if(request.action === "toggle_enabled") {
    var tabId = request.tab_target;
    var enabled = request.enabled;
    console.log("🎵 Background: Toggling tab", tabId, "enabled state to:", enabled);

    skSites.markTabEnabledState(tabId, enabled);
    response({success: true, enabled: enabled});
    return true;
  }
  if(request.action === "check_music_site") {
    /**
       * A tab index of -1 means that the tab is "embedded" in a page
       * We should only inject into actual tabs
       */
    if(sender.tab.index === -1) {
      response("no_inject");
      return true;
    }

    try {
      var result = skSites.checkMusicSite(sender.tab.url);
      console.log("checkMusicSite result for", sender.tab.url, ":", result);
      response(result);
    } catch (error) {
      console.error("Error in checkMusicSite:", error);
      response("no_inject");
    }
    return true;
  }
  if(request.action === "get_commands") {
    response(coms);
    return true;
  }
  if(request.action === "command") {
    processCommand(request);
    return true;
  }
  if(request.action === "update_player_state") {
    tabStates[sender.tab.id] = {
      "timestamp": Date.now(),
      "state": request.stateData
    };
    chrome.runtime.sendMessage({
      action: "update_popup_state",
      stateData: request.stateData,
      fromTab: sender.tab
    });
    if (mprisPort) handleStateData(updateMPRISState);
    return true;
  }
  if(request.action === "get_music_tabs") {
    var musicTabs = skSites.getMusicTabs();
    musicTabs.then(function(tabs) {
      // Validate that all tabs still exist before returning them
      var validTabs = { enabled: [], disabled: [] };
      var tabsToCheck = [];

      if (tabs.enabled) {
        tabsToCheck = tabsToCheck.concat(tabs.enabled.map(tab => ({tab, isEnabled: true})));
      }
      if (tabs.disabled) {
        tabsToCheck = tabsToCheck.concat(tabs.disabled.map(tab => ({tab, isEnabled: false})));
      }

      if (tabsToCheck.length === 0) {
        response(validTabs);
        return;
      }

      var checkedCount = 0;
      tabsToCheck.forEach(({tab, isEnabled}) => {
        chrome.tabs.get(tab.id, () => {
          checkedCount++;
          if (!chrome.runtime.lastError) {
            // Tab still exists, add it to valid tabs
            if (isEnabled) {
              validTabs.enabled.push(tab);
            } else {
              validTabs.disabled.push(tab);
            }
          } else {
            console.log("Removing stale tab reference:", tab.id, chrome.runtime.lastError.message);
          }

          // When all tabs are checked, return the valid ones
          if (checkedCount === tabsToCheck.length) {
            response(validTabs);
          }
        });
      });
    });
    return true;
  }
  if(request.action === "send_change_notification") {
    if (skSites.checkShowNotifications(sender.tab.url) &&
          skSites.checkTabEnabled(sender.tab.id)) {
      sendChangeNotification(request, sender);
    }
    return true;
  }
  if(request.action === "content_script_ready") {
    console.log("Content script ready on tab", sender.tab.id, "URL:", request.url);
    // We could track ready content scripts here if needed
    return true;
  }

  // Default return true to keep message channel open
  return true;
});

var sendChangeNotification = function(request, sender) {
  if (!request.stateData.song) {
    return;
  }

  var notificationItems = [
    { title: request.stateData.song.trim(), message: "" },
  ];

  if (request.stateData.artist || request.stateData.album) {
    notificationItems.push({ title: (request.stateData.artist || "").trim(), message: (request.stateData.album || "").trim() });
  }

  if (request.stateData.currentTime || request.stateData.totalTime) {
    notificationItems.push({ title: (request.stateData.currentTime || "").trim(), message: (request.stateData.totalTime || "").trim() });
  }

  chrome.notifications.create(sender.id + request.stateData.siteName, {
    type: "list",
    title: request.stateData.siteName,
    message: (request.stateData.song || "").trim(),
    iconUrl: request.stateData.art || chrome.runtime.getURL("icon128.png"),
    items: notificationItems
  }, function(notificationId) {
    if(notificationTimeouts[notificationId])
    {
      clearTimeout(notificationTimeouts[notificationId]);
      delete notificationTimeouts[notificationId];
    }

    notificationTimeouts[notificationId] = setTimeout(function() {
      chrome.notifications.clear(notificationId);
    }, 5000);
  });
};

/**
   * Copy over old settings from local storageArea to sync.
   * @note This change introduced in v1.5.5. Deprecate this at some point in the future.
   */
var storageInitializedCheck = new Promise(function(resolve) {
  chrome.storage.sync.get(function(syncStorageObj) {
    if(syncStorageObj["hotkey-initialized"]) {
      resolve();
    } else {
      var newStorageObj = {
        "hotkey-initialized": true
      };

      chrome.storage.local.get(function(localStorageObj) {
        _.forEach(localStorageObj, function(value, key) {
          newStorageObj[key] = value;
        });

        chrome.storage.sync.set(newStorageObj, function() {
          resolve();
        });
      });
    }
  });
});

storageInitializedCheck.then(function() {
  // Open info page on install/update
  chrome.runtime.onInstalled.addListener(function(details) {
    chrome.storage.sync.get(function(obj) {
      if(obj["hotkey-open_on_update"] || typeof obj["hotkey-open_on_update"] === "undefined") {
        if(details.reason == "install") {
          chrome.tabs.create({
            url: "http://www.streamkeys.com/guide.html?installed=true"
          });
        }
      }
    });
  });

  // Store commands in global
  chrome.commands.getAll(function(cmds) {
    coms = cmds;
  });

  // Site list is already initialized above
  skSites.loadSettings();
});


/**
   * MPRIS support
   */
var connections = 0;
var mprisPort = null;

var hmsToSecondsOnly = function(str) {
  var p = str.split(":");
  var s = 0;
  var m = 1;

  while (p.length > 0) {
    s += m * parseInt(p.pop(), 10);
    m *= 60;
  }

  return s;
};

var handleNativeMsg = function(msg) {
  switch(msg.command) {
  case "play":
  case "pause":
  case "playpause":
    sendAction("playPause");
    break;
  case "stop":
    sendAction("stop");
    break;
  case "next":
    sendAction("playNext");
    break;
  case "previous":
    sendAction("playPrev");
    break;
  default:
    console.log("Cannot handle native message command: " + msg.command);
  }
};

/**
   * Get the state of the player that a command will end up affecting and pass
   * it to a function to handle them, along with the tab that corresponds to
   * that state data.
   * For "single player mode" (which is required for MPRIS support), a command
   * will end up affecting the best tab if there are active tabs but no
   * playing tabs, or all playing tabs if there are playing tabs (see
   * sendActionSinglePlayer). With that in mind:
   * - If there is no active tab, then the state and the tab are null.
   * - If there are active tabs but no playing tabs, use the best tab.
   * - If there are any playing tabs, just use the state of the best playing
   *   tab. The command will be sent to all playing tabs anyway.
   */
var handleStateData = function(func) {
  var activeMusicTabs = skSites.getActiveMusicTabs();
  activeMusicTabs.then(function(tabs) {
    if (_.isEmpty(tabs)) {
      func(null, null);
    } else {
      var bestTab = null;
      var playingTabs = getPlayingTabs(tabs);
      if (_.isEmpty(playingTabs)){
        bestTab = getBestSinglePlayerTab(tabs);
      } else {
        bestTab = getBestSinglePlayerTab(playingTabs);
      }

      func(tabStates[bestTab.id].state, bestTab);
    }
  });
};

/**
   * If stateData is null, then state is stopped with NoTrack. Otherwise update
   * with the state of the player that a command will end up affecting.
   */
var updateMPRISState = function(stateData, tab) {
  if (stateData === null) {
    mprisPort.postMessage({ command: "remove_player" });
  } else {
    var metadata = {
      "mpris:trackid": stateData.song ? tab.id : null,
      "xesam:title": stateData.song,
      "xesam:artist": stateData.artist ? [stateData.artist.trim()] : null,
      "xesam:album": stateData.album,
      "mpris:artUrl": stateData.art,
      "mpris:length": hmsToSecondsOnly((stateData.totalTime || "0").trim()) * 1000000
    };
    var args = [{ "CanGoNext": stateData.canPlayNext,
      "CanGoPrevious": stateData.canPlayPrev,
      "PlaybackStatus": (stateData.isPlaying ? "Playing" : "Paused"),
      "CanPlay": stateData.canPlayPause,
      "CanPause": stateData.canPlayPause,
      "Metadata": metadata,
      "Position": hmsToSecondsOnly((stateData.currentTime || "0").trim()) * 1000000}];

    mprisPort.postMessage({ command: "update_state", args: args });
  }
};

/**
   * Connect to the native messaging host for MPRIS support
   */
chrome.storage.sync.get(function(obj) {

  if (Object.prototype.hasOwnProperty.call(obj,"hotkey-use_mpris") && obj["hotkey-use_mpris"]) {
    if (!connections) {
      connections += 1;
      console.log("Starting native messaging host");
      mprisPort = chrome.runtime.connectNative("org.mpris.streamkeys_host");
      mprisPort.onMessage.addListener(handleNativeMsg);

      chrome.runtime.onSuspend.addListener(function() {
        if (!--connections)
          mprisPort.postMessage({ command: "quit" });
        mprisPort.onMessage.removeListener(handleNativeMsg);
        mprisPort.disconnect();
      });

      /**
         * When a music tab is removed, we must remove it from tabStates and
         * update the state of the MPRIS player.
         */
      chrome.tabs.onRemoved.addListener(function(tabId) {
        if (Object.prototype.hasOwnProperty.call(tabStates,tabId)) {
          delete tabStates[tabId];
          handleStateData(updateMPRISState);
        }
      });

      /**
         * When the active tab changes, the best single tab might change too.
         * Thus we need to update the state of the MPRIS player.
         */
      chrome.tabs.onActivated.addListener(function(activeInfo) {
        if (Object.prototype.hasOwnProperty.call(tabStates,activeInfo.tabId)) {
          handleStateData(updateMPRISState);
        }
      });

    }
  }
});

// Initialize site settings on startup
try {
  skSites.loadSettings().then(function() {
    console.log("Site settings loaded successfully");
  }).catch(function(error) {
    console.error("Failed to load site settings:", error);
  });
} catch (error) {
  console.error("Error during initialization:", error);
}
