"use strict";

// Note: For MV3 compatibility, we need to include knockout and material-design-lite as web accessible resources
// or use alternatives. For now, this is a minimal implementation that works with the existing HTML structure.

var PopupViewModel = function PopupViewModel() {
  var self = this;
  console.log("PopupViewModel initializing...");

  // Simple observable implementation to replace knockout
  function Observable(value) {
    var callbacks = [];
    var currentValue = value;

    var observable = function(newValue) {
      if (arguments.length === 0) {
        return currentValue;
      } else {
        currentValue = newValue;
        callbacks.forEach(function(callback) { callback(newValue); });
        return observable;
      }
    };

    observable.subscribe = function(callback) {
      callbacks.push(callback);
      return {
        dispose: function() {
          var index = callbacks.indexOf(callback);
          if (index > -1) callbacks.splice(index, 1);
        }
      };
    };

    observable.peek = function() {
      return currentValue;
    };

    return observable;
  }

  function ObservableArray(initialArray) {
    var arr = initialArray || [];
    var callbacks = [];

    var observableArray = function() {
      return arr.slice(); // Return copy
    };

    observableArray.push = function(item) {
      arr.push(item);
      callbacks.forEach(function(callback) {
        callback();
      });
    };

    observableArray.subscribe = function(callback) {
      callbacks.push(callback);
    };

    observableArray.peek = function() {
      return arr.slice();
    };

    return observableArray;
  }

  self.totalMusicTabs = Observable(1);
  self.musicTabsLoaded = Observable(0);
  self.musicTabs = ObservableArray([]);

  // Tabs from disabled music sites to show in disabled list toggle
  self.disabledMusicTabs = ObservableArray([]);
  self.disabledSitesOpen = Observable(false);

  // Simplified sorting - will need to implement lodash-like functions
  self.sortedMusicTabs = function() {
    var tabs = self.musicTabs();
    // Simple sort by siteName for now
    return tabs.sort(function(a, b) {
      if (a.siteName && b.siteName) {
        return a.siteName.localeCompare(b.siteName);
      }
      return 0;
    });
  };

  self.isLoaded = function() {
    return self.musicTabsLoaded() == self.totalMusicTabs();
  };

  self.visibleMusicTabs = ObservableArray([]);
  self.optionsUrl = Observable(chrome.runtime.getURL("html/options.html"));

  self.openOptionsPage = function() {
    window.open(self.optionsUrl());
  };

  // Send a request to get the player state of every active music site tab
  console.log("Requesting music tabs from background...");
  chrome.runtime.sendMessage({ action: "get_music_tabs" }, function(response) {
    console.log("Got music tabs response:", response);
    if (response) {
      self.getTabStates.call(self, response);
    } else {
      console.error("No response from background script");
    }
  });

  // Setup listener for updating the popup state
  chrome.runtime.onMessage.addListener(function(request) {
    console.log("Popup received message:", request);
    if(request.action === "update_popup_state" && request.stateData) {
      self.updateState(request.stateData, request.fromTab);
    }
  });
};

PopupViewModel.prototype.updateState = function(stateData, tab, disabled) {
  if(typeof stateData == "undefined") return false;

  var self = this;
  console.log("updateState called with:", stateData, tab, disabled);

  // Find existing tab using simple array methods instead of lodash
  var allTabs = this.musicTabs().concat(this.disabledMusicTabs());
  var musicTab = allTabs.find(function(itTab) {
    return itTab.tabId == tab.id;
  });

  if(musicTab) {
    console.log("Updating existing tab:", musicTab.tabId);
    // Update observables
    musicTab.observableProperties.forEach(function(property) {
      if(typeof stateData[property] !== "undefined") {
        musicTab[property](stateData[property]);
      }
    });
    // Update siteName if provided
    if(stateData.siteName) {
      musicTab.siteName = stateData.siteName;
    }
  } else {
    console.log("Creating new tab:", tab.id, "disabled:", disabled);
    // Create new tab using Object.assign instead of lodash
    var tabData = Object.assign({}, stateData, {
      tabId: tab.id,
      faviconUrl: tab.favIconUrl,
      priority: tab.streamkeysPriority || 1,
      siteKey: tab.streamkeysSiteKey,
      siteName: stateData.siteName || "Unknown Site", // Use siteName from stateData with fallback
      streamkeysEnabled: typeof tab.streamkeysEnabled !== "undefined" ? tab.streamkeysEnabled : true,
    });

    console.log("New tab data:", tabData);
    musicTab = new MusicTab(tabData);

    if(disabled) {
      this.disabledMusicTabs.push(musicTab);
    } else {
      this.musicTabs.push(musicTab);
    }

    // Subscribe to each sites priority to maintain state if multiple tabs are open
    musicTab.priority.subscribe(function(newPriority) {
      self.musicTabs().forEach(function(tab) {
        if(tab.siteKey === this.siteKey && tab.tabId !== this.tabId && tab.priority() !== newPriority) {
          tab.priority(newPriority);
        }
      }, this);
    }, musicTab);
  }
};

/**
 * Query each active music tab for the player state, then update the popup state
 * @param {Array} tabs - array of active music tabs
 */
PopupViewModel.prototype.getTabStates = function(tabs) {
  var that = this;
  console.log("getTabStates called with:", tabs);

  if (!tabs || (!tabs.enabled && !tabs.disabled)) {
    console.error("Invalid tabs object:", tabs);
    return;
  }

  var enabledTabs = tabs.enabled || [];
  var disabledTabs = tabs.disabled || [];

  that.totalMusicTabs(enabledTabs.length + disabledTabs.length);
  console.log("Total music tabs:", enabledTabs.length + disabledTabs.length);

  enabledTabs.forEach(function(tab) {
    console.log("Querying enabled tab:", tab.id, tab.url);

    // Add retry mechanism for connection issues
    function queryTab(retryCount) {
      chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (function(playerState) {
        console.log("Got player state for tab", this.tab.id, ":", playerState);
        if (chrome.runtime.lastError) {
          console.warn("Error getting player state for tab", this.tab.id, ":", chrome.runtime.lastError.message);
          // Retry up to 3 times with increasing delay
          if (retryCount < 3 && chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
            console.log("Retrying tab query in", (retryCount + 1) * 500, "ms");
            setTimeout(function() {
              queryTab(retryCount + 1);
            }, (retryCount + 1) * 500);
            return; // Don't increment loaded count yet
          }
        } else {
          that.updateState(playerState, this.tab);
        }
        that.musicTabsLoaded(that.musicTabsLoaded() + 1);
      }).bind({ tab: tab }));
    }

    queryTab(0);
  });

  disabledTabs.forEach(function(tab) {
    console.log("Querying disabled tab:", tab.id, tab.url);

    // Add retry mechanism for connection issues
    function queryDisabledTab(retryCount) {
      chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (function(playerState) {
        console.log("Got player state for disabled tab", this.tab.id, ":", playerState);
        if (chrome.runtime.lastError) {
          console.warn("Error getting player state for disabled tab", this.tab.id, ":", chrome.runtime.lastError.message);
          // Retry up to 3 times with increasing delay
          if (retryCount < 3 && chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
            console.log("Retrying disabled tab query in", (retryCount + 1) * 500, "ms");
            setTimeout(function() {
              queryDisabledTab(retryCount + 1);
            }, (retryCount + 1) * 500);
            return; // Don't increment loaded count yet
          }
        } else {
          that.updateState(playerState, this.tab, true);
        }
        that.musicTabsLoaded(that.musicTabsLoaded() + 1);
      }).bind({ tab: tab }));
    }

    queryDisabledTab(0);
  });
};

var MusicTab = (function() {
  // Simple observable implementation for MusicTab
  function Observable(value) {
    var callbacks = [];
    var currentValue = value;

    var observable = function(newValue) {
      if (arguments.length === 0) {
        return currentValue;
      } else {
        currentValue = newValue;
        callbacks.forEach(function(callback) { callback(newValue); });
        return observable;
      }
    };

    observable.subscribe = function(callback) {
      callbacks.push(callback);
      return {
        dispose: function() {
          var index = callbacks.indexOf(callback);
          if (index > -1) callbacks.splice(index, 1);
        }
      };
    };

    observable.peek = function() {
      return currentValue;
    };

    return observable;
  }

  function MusicTab(attributes) {
    var self = this;
    console.log("MusicTab constructor called with:", attributes);

    this.observableProperties = [
      "song",
      "artist",
      "streamkeysEnabled",
      "priority",
      "isPlaying",
      "canPlayPause",
      "canPlayNext",
      "canPlayPrev",
      "canLike",
      "canDislike"
    ];

    // Assign all properties from attributes
    Object.assign(this, attributes);

    // Set siteName from attributes or default
    this.siteName = attributes.siteName || "YouTube";

    /** Override observables **/
    this.observableProperties.forEach((function(property) {
      this[property] = Observable(typeof attributes[property] !== "undefined" ? attributes[property] : null);
    }).bind(this));

    /** Popup specific observables **/
    this.songArtistText = function() {
      if(!this.song()) return "";
      return (this.artist()) ? this.artist() + " - " + this.song() : this.song();
    }.bind(this);

    this.settingsOpen = Observable(false);

    this.priority.subscribe(function(priority) {
      chrome.runtime.sendMessage({
        action: "update_site_settings",
        siteKey: self.siteKey,
        siteState: {
          priority: priority
        }
      });
    });

    this.sendAction = function(action) {
      chrome.runtime.sendMessage({
        action: "command",
        command: action,
        tab_target: this.tabId
      });
    };

    this.openTab = function() {
      chrome.tabs.update(parseInt(this.tabId), { active: true });
    };

    this.toggleStreamkeysEnabled = function() {
      this.streamkeysEnabled(!this.streamkeysEnabled());
      // Send message to background script instead of direct background page access
      chrome.runtime.sendMessage({
        action: "mark_tab_enabled_state",
        tabId: this.tabId,
        enabled: this.streamkeysEnabled()
      });
    };
  }

  return MusicTab;
})();

function updateBindings(popup) {
  console.log("updateBindings called, popup loaded:", popup.isLoaded());

  // First check if we have the proper container
  var playerDiv = document.getElementById("player");
  if (!playerDiv) {
    console.error("Player div not found!");
    return;
  }

  // Clear existing content except the loading message if still loading
  if (!popup.isLoaded()) {
    playerDiv.innerHTML = "<div class=\"no-sites\">Loading...</div>";
    return;
  }

  var tabs = popup.sortedMusicTabs();
  console.log("Updating music tabs, count:", tabs.length);

  if (tabs.length === 0) {
    playerDiv.innerHTML = "<div class=\"no-sites\">No music sites open.</div>";
    return;
  }

  // Clear and populate with music tabs
  playerDiv.innerHTML = "";

  tabs.forEach(function(tab) {
    var tabElement = document.createElement("div");
    tabElement.className = "site-tab-container";
    if (!tab.streamkeysEnabled()) {
      tabElement.classList.add("disabled");
    }

    var songText = tab.songArtistText ? tab.songArtistText() : "";
    var siteName = tab.siteName || "Unknown Site";
    var priority = tab.priority ? tab.priority() : "1";
    var isPlaying = tab.isPlaying ? tab.isPlaying() : false;

    console.log("Creating tab element for:", siteName, "song:", songText, "playing:", isPlaying);

    // Create the structure similar to V2
    tabElement.innerHTML =
      "<div class=\"player-row player-container\">" +
        "<div class=\"site-data\">" +
          "<span class=\"site-priority-label\">" + priority + "</span>" +
          "<a tabindex=\"-1\" href=\"#\" class=\"site-link\" title=\"Open Tab\">" +
            "<img class=\"site-favicon\" src=\"" + (tab.faviconUrl || "") + "\" />" +
            "<span class=\"site-title\">" + siteName + "</span>" +
          "</a>" +
        "</div>" +
        (songText ? "<div class=\"marquee song-data\"><p class=\"song-text\">" + songText + "</p></div>" : "") +
      "</div>" +
      "<div class=\"player-controls-container player-container\">" +
        "<button class=\"player-controls-button\" data-action=\"settings\" title=\"Settings\">⋮</button>" +
        "<button class=\"player-controls-button " + (!tab.canPlayPrev || !tab.canPlayPrev() ? "disabled" : "") + "\" data-action=\"playPrev\" title=\"Previous\">⏮</button>" +
        "<button class=\"player-controls-button\" data-action=\"playPause\" title=\"" + (isPlaying ? "Pause" : "Play") + "\">" + (isPlaying ? "⏸" : "▶") + "</button>" +
        "<button class=\"player-controls-button " + (!tab.canPlayNext || !tab.canPlayNext() ? "disabled" : "") + "\" data-action=\"playNext\" title=\"Next\">⏭</button>" +
        "<button class=\"player-controls-button " + (!tab.streamkeysEnabled() ? "active" : "") + "\" data-action=\"toggleEnabled\" title=\"Toggle Extension\">🚫</button>" +
      "</div>";

    // Add event listeners
    var siteLink = tabElement.querySelector(".site-link");
    if (siteLink) {
      siteLink.addEventListener("click", function(e) {
        e.preventDefault();
        tab.openTab();
      });
    }

    var buttons = tabElement.querySelectorAll("button[data-action]");
    buttons.forEach(function(button) {
      var action = button.getAttribute("data-action");
      button.addEventListener("click", function(e) {
        e.preventDefault();
        if (button.classList.contains("disabled")) return;

        if (action === "toggleEnabled") {
          tab.toggleStreamkeysEnabled();
          // Update visual state immediately
          setTimeout(function() { updateBindings(popup); }, 100);
        } else if (action === "settings") {
          // Toggle settings (would need to implement this)
        } else {
          tab.sendAction(action);
        }
      });
    });

    playerDiv.appendChild(tabElement);
  });
}

document.addEventListener("DOMContentLoaded", function() {
  window.popup = new PopupViewModel();

  // Add event listeners for option buttons
  var optionsLink = document.getElementById("options-link");
  if (optionsLink) {
    optionsLink.addEventListener("click", function(e) {
      e.preventDefault();
      if (window.popup) {
        window.popup.openOptionsPage();
      }
    }, { passive: false });
  }

  var helpLink = document.getElementById("help-link");
  if (helpLink) {
    helpLink.addEventListener("click", function(e) {
      e.preventDefault();
      window.open("http://www.streamkeys.com/guide.html");
    }, { passive: false });
  }

  var donateLink = document.getElementById("donate-link");
  if (donateLink) {
    donateLink.addEventListener("click", function(e) {
      e.preventDefault();
      window.open("http://www.streamkeys.com/donate.html");
    }, { passive: false });
  }

  // Update once initially, then only when data changes
  setTimeout(function() {
    updateBindings(window.popup);
  }, 100);

  // Listen for data changes instead of polling
  var lastTabCount = 0;
  var lastLoadedCount = 0;

  function checkForUpdates() {
    if (window.popup) {
      var currentTabCount = window.popup.musicTabs().length;
      var currentLoadedCount = window.popup.musicTabsLoaded();

      if (currentTabCount !== lastTabCount || currentLoadedCount !== lastLoadedCount) {
        console.log("Data changed, updating bindings");
        updateBindings(window.popup);
        lastTabCount = currentTabCount;
        lastLoadedCount = currentLoadedCount;
      }
    }
  }

  // Check every 2 seconds instead of every second, and only update if needed
  setInterval(checkForUpdates, 2000);
});
