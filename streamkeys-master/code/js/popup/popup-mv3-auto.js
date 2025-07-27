"use strict";

// MV3-compatible popup script - TRUE V2 mirror with automatic data binding
// Key insight: V2 NEVER manually updates UI - Knockout handles everything automatically

// Enhanced observable implementation that mimics Knockout.js exactly
function Observable(initialValue) {
  let value = initialValue;
  let subscribers = [];
  let isNotifying = false;

  function obs(newValue) {
    if (arguments.length === 0) {
      return value;
    }
    if (value !== newValue && !isNotifying) {
      value = newValue;
      isNotifying = true;
      subscribers.forEach(callback => {
        try {
          callback(value);
        } catch (error) {
          console.error("Observable callback error:", error);
        }
      });
      isNotifying = false;
    }
    return obs;
  }

  obs.subscribe = function(callback) {
    subscribers.push(callback);
    return {
      dispose: function() {
        const index = subscribers.indexOf(callback);
        if (index > -1) subscribers.splice(index, 1);
      }
    };
  };

  obs.peek = function() {
    return value;
  };

  return obs;
}

function ObservableArray(initialArray = []) {
  let arr = [...initialArray];
  let subscribers = [];
  let isNotifying = false;

  function obsArray() {
    return [...arr];
  }

  obsArray.push = function(item) {
    arr.push(item);
    if (!isNotifying) {
      isNotifying = true;
      subscribers.forEach(callback => {
        try {
          callback([...arr]);
        } catch (error) {
          console.error("ObservableArray callback error:", error);
        }
      });
      isNotifying = false;
    }
    return obsArray;
  };

  obsArray.remove = function(item) {
    const index = arr.indexOf(item);
    if (index > -1) {
      arr.splice(index, 1);
      if (!isNotifying) {
        isNotifying = true;
        subscribers.forEach(callback => {
          try {
            callback([...arr]);
          } catch (error) {
            console.error("ObservableArray callback error:", error);
          }
        });
        isNotifying = false;
      }
    }
    return obsArray;
  };

  obsArray.subscribe = function(callback) {
    subscribers.push(callback);
    return {
      dispose: function() {
        const index = subscribers.indexOf(callback);
        if (index > -1) subscribers.splice(index, 1);
      }
    };
  };

  obsArray.peek = function() {
    return [...arr];
  };

  return obsArray;
}

// Computed observable that auto-updates dependents
function Computed(computeFn, context) {
  let computedValue;
  let isInitialized = false;
  let subscribers = [];
  let isComputing = false;

  function computed() {
    if (!isInitialized && !isComputing) {
      isComputing = true;
      try {
        computedValue = computeFn.call(context);
        isInitialized = true;
      } catch (error) {
        console.error("Computed function error:", error);
        computedValue = null;
      }
      isComputing = false;
    }
    return computedValue;
  }

  computed.subscribe = function(callback) {
    subscribers.push(callback);
    return {
      dispose: function() {
        const index = subscribers.indexOf(callback);
        if (index > -1) subscribers.splice(index, 1);
      }
    };
  };

  computed.refresh = function() {
    if (!isComputing) {
      isComputing = true;
      try {
        const newValue = computeFn.call(context);
        if (newValue !== computedValue) {
          computedValue = newValue;
          subscribers.forEach(callback => {
            try {
              callback(newValue);
            } catch (error) {
              console.error("Computed callback error:", error);
            }
          });
        }
      } catch (error) {
        console.error("Computed refresh error:", error);
      }
      isComputing = false;
    }
  };

  return computed;
}

// Music Tab Model (exactly like V2 MusicTab)
var MusicTab = function(attributes) {
  var self = this;

  // Observable properties list (exactly as V2)
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

  // Non-observable properties
  this.tabId = attributes.tabId;
  this.faviconUrl = attributes.faviconUrl || "";
  this.siteName = attributes.siteName || "Unknown Site";
  this.siteKey = attributes.siteKey || "";

  // Create observables for each property (exactly like V2)
  this.observableProperties.forEach(function(property) {
    self[property] = Observable(typeof attributes[property] !== "undefined" ? attributes[property] : null);
  });

  // Computed songArtistText (exactly like V2)
  this.songArtistText = Computed(function() {
    if (!this.song()) return "";
    return (this.artist()) ? this.artist() + " - " + this.song() : this.song();
  }, this);

  // Popup specific observables
  this.settingsOpen = Observable(false);

  // Priority subscription for multi-tab sync (exactly like V2)
  this.priority.subscribe(function(priority) {
    chrome.runtime.sendMessage({
      action: "update_site_settings",
      siteKey: self.siteKey,
      siteState: {
        priority: priority
      }
    });
  });

  // Actions (exactly like V2)
  this.sendAction = function(action) {
    chrome.runtime.sendMessage({
      action: "command",
      command: action,
      tab_target: this.tabId
    });
  };

  this.openTab = function() {
    chrome.tabs.update(parseInt(this.tabId), { active: true });
    window.close();
  };

  this.toggleStreamkeysEnabled = function() {
    var newState = !this.streamkeysEnabled.peek();
    this.streamkeysEnabled(newState);

    chrome.runtime.sendMessage({
      action: "toggle_enabled",
      tab_target: this.tabId,
      enabled: newState
    }, function() {
      if (chrome.runtime.lastError) {
        console.warn("Error toggling streamkeys:", chrome.runtime.lastError.message);
        // Revert state on error
        self.streamkeysEnabled(!newState);
      }
    });
  };
};

// Main Popup View Model (exactly like V2 PopupViewModel)
var PopupViewModel = function() {
  var self = this;

  // Core observables (exactly as V2)
  self.totalMusicTabs = Observable(1);
  self.musicTabsLoaded = Observable(0);
  self.musicTabs = ObservableArray([]);
  self.disabledMusicTabs = ObservableArray([]);
  self.disabledSitesOpen = Observable(false);

  // Computed properties (exactly like V2)
  self.sortedMusicTabs = Computed(function() {
    var tabs = self.musicTabs();
    // Filter out hidden players and group by priority (exactly like V2)
    var filtered = tabs.filter(function(tab) {
      return (tab.canPlayPause() || !tab.hidePlayer);
    });

    // Group by priority
    var grouped = {};
    filtered.forEach(function(tab) {
      var priority = tab.priority();
      if (!grouped[priority]) grouped[priority] = [];
      grouped[priority].push(tab);
    });

    // Sort keys by priority descending
    var sortedKeys = Object.keys(grouped).sort(function(a, b) {
      return parseInt(b) - parseInt(a);
    });

    // Build final sorted array
    var result = [];
    sortedKeys.forEach(function(key) {
      var priorityGroup = grouped[key].sort(function(a, b) {
        if (a.siteName !== b.siteName) {
          return a.siteName.localeCompare(b.siteName);
        }
        return a.tabId - b.tabId;
      });
      result = result.concat(priorityGroup);
    });

    return result;
  }, self);

  self.isLoaded = Computed(function() {
    return self.musicTabsLoaded() === self.totalMusicTabs();
  }, self);

  self.optionsUrl = chrome.runtime.getURL("html/options.html");

  self.openOptionsPage = function() {
    window.open(self.optionsUrl);
  };

  // NO MANUAL UI UPDATES - observables handle everything automatically
  // Set up automatic DOM updates when observables change (like Knockout data-bind)
  self.setupAutoBinding();

  // Initialize (exactly like V2)
  chrome.runtime.sendMessage({ action: "get_music_tabs" }, self.getTabStates.bind(self));

  // Setup listener for updating the popup state (exactly like V2)
  chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === "update_popup_state" && request.stateData) {
      self.updateState(request.stateData, request.fromTab);
    }
  });
};

// Setup automatic data binding (replaces Knockout.js data-bind)
PopupViewModel.prototype.setupAutoBinding = function() {
  var self = this;
  console.log("*** SETUP AUTO-BINDING CALLED - SUBSCRIBING TO OBSERVABLES ***");

  // Auto-update when sorted tabs change
  self.sortedMusicTabs.subscribe(function(newTabs) {
    console.log("*** ENABLED TABS CHANGED, AUTO-UPDATING UI ***", newTabs);
    self.renderEnabledTabs(newTabs);
  });

  // Auto-update when disabled tabs change
  self.disabledMusicTabs.subscribe(function(newTabs) {
    console.log("*** DISABLED TABS CHANGED, AUTO-UPDATING UI ***", newTabs);
    self.renderDisabledSection(newTabs);
  });

  // Auto-update when load state changes
  self.isLoaded.subscribe(function(isLoaded) {
    if (isLoaded) {
      self.renderDisabledSection(self.disabledMusicTabs());
    }
  });

  // Auto-update disabled sites toggle
  self.disabledSitesOpen.subscribe(function(isOpen) {
    self.updateDisabledToggle(isOpen);
  });
};

PopupViewModel.prototype.renderEnabledTabs = function(tabs) {
  var playerDiv = document.getElementById("player");
  var enabledContainer = playerDiv.querySelector(".enabled-tabs-container");

  if (!enabledContainer) {
    // First time setup
    var noSitesDiv = "<div class=\"no-sites\" style=\"display: none;\">No music sites open.</div>";
    var enabledDiv = "<div class=\"enabled-tabs-container\"></div>";
    var disabledDiv = "<div class=\"disabled-section-container\"></div>";
    playerDiv.innerHTML = noSitesDiv + enabledDiv + disabledDiv;
    enabledContainer = playerDiv.querySelector(".enabled-tabs-container");
  }

  // Show/hide no sites message
  var sitesDiv = playerDiv.querySelector(".no-sites");
  var hasAnyTabs = tabs.length > 0 || this.disabledMusicTabs().length > 0;
  sitesDiv.style.display = (this.isLoaded() && !hasAnyTabs) ? "block" : "none";

  // Render enabled tabs
  var html = "";
  tabs.forEach(function(tab) {
    html += this.renderSiteTab(tab, false);
  }, this);

  enabledContainer.innerHTML = html;
  this.bindTabEvents(enabledContainer);
};

// Render disabled section only (no full page rebuild)
PopupViewModel.prototype.renderDisabledSection = function(disabledTabs) {
  var playerDiv = document.getElementById("player");
  var disabledContainer = playerDiv.querySelector(".disabled-section-container");

  if (!disabledContainer) return; // Not initialized yet

  if (disabledTabs.length === 0 || !this.isLoaded()) {
    disabledContainer.innerHTML = "";
    return;
  }

  var toggleText = this.disabledSitesOpen() ? "Hide Disabled Sites" : "Show Disabled Sites";
  var toggleIcon = this.disabledSitesOpen() ? "arrow_drop_up" : "arrow_drop_down";
  var isOpen = this.disabledSitesOpen();

  var html = "" +
    "<button id=\"btn-disabled-sites\" class=\"mdl-button mdl-js-button mdl-button--raised mdl-button--colored\">" +
      "<span>" + toggleText + "</span>" +
      "<i class=\"material-icons\">" + toggleIcon + "</i>" +
    "</button>" +
    "<div class=\"disabled-site-tab-container\" style=\"display: " + (isOpen ? "block" : "none") + "\">";

  disabledTabs.forEach(function(tab) {
    html += this.renderSiteTab(tab, true);
  }, this);

  html += "</div>";

  disabledContainer.innerHTML = html;
  this.bindDisabledToggle();
  this.bindTabEvents(disabledContainer);
};

// Update only the disabled toggle (no rebuild)
PopupViewModel.prototype.updateDisabledToggle = function(isOpen) {
  var toggleBtn = document.getElementById("btn-disabled-sites");
  var container = document.querySelector(".disabled-site-tab-container");

  if (toggleBtn && container) {
    var span = toggleBtn.querySelector("span");
    var icon = toggleBtn.querySelector("i");

    span.textContent = isOpen ? "Hide Disabled Sites" : "Show Disabled Sites";
    icon.textContent = isOpen ? "arrow_drop_up" : "arrow_drop_down";
    container.style.display = isOpen ? "block" : "none";
  }
};

// Update state method (exactly like V2)
PopupViewModel.prototype.updateState = function(stateData, tab, disabled) {
  if (typeof stateData === "undefined") return false;

  var self = this;

  // Find existing tab (exactly like V2)
  var allTabs = this.musicTabs.peek().concat(this.disabledMusicTabs.peek());
  var musicTab = allTabs.find(function(itTab) {
    return itTab.tabId === tab.id;
  });

  if (musicTab) {
    // Update observables (exactly like V2) - this triggers automatic UI updates
    musicTab.observableProperties.forEach(function(property) {
      if (typeof stateData[property] !== "undefined") {
        musicTab[property](stateData[property]);
      }
    });
  } else {
    // Create new tab (exactly like V2)
    var tabData = Object.assign({}, stateData, {
      tabId: tab.id,
      faviconUrl: tab.favIconUrl,
      priority: tab.streamkeysPriority || 5,
      siteKey: tab.streamkeysSiteKey,
      streamkeysEnabled: typeof tab.streamkeysEnabled !== "undefined" ? tab.streamkeysEnabled : true,
    });

    musicTab = new MusicTab(tabData);

    if (disabled) {
      this.disabledMusicTabs.push(musicTab);
    } else {
      this.musicTabs.push(musicTab);
    }

    // Subscribe to priority changes for multi-tab sync (exactly like V2)
    musicTab.priority.subscribe(function(newPriority) {
      self.musicTabs().forEach(function(tab) {
        if (tab.siteKey === this.siteKey && tab.tabId !== this.tabId && tab.priority() !== newPriority) {
          tab.priority(newPriority);
        }
      }, this);
    }, musicTab);

    // Auto-bind individual tab observables for real-time updates
    self.bindTabObservables(musicTab);
  }

  // Refresh computed observables (this triggers automatic UI updates)
  this.sortedMusicTabs.refresh();
  this.isLoaded.refresh();
};

// Bind individual tab observables for real-time updates (like Knockout data-bind)
PopupViewModel.prototype.bindTabObservables = function(tab) {
  var self = this;

  // Update play/pause button when playing state changes
  tab.isPlaying.subscribe(function(isPlaying) {
    self.updatePlayButton(tab.tabId, isPlaying);
  });

  // Update song text when song changes
  tab.songArtistText.subscribe(function(songText) {
    self.updateSongText(tab.tabId, songText);
  });

  // Update enabled state when streamkeysEnabled changes
  tab.streamkeysEnabled.subscribe(function(enabled) {
    self.updateTabEnabledState(tab.tabId, enabled);
  });

  // Update priority display when priority changes
  tab.priority.subscribe(function(priority) {
    self.updatePriorityDisplay(tab.tabId, priority);
  });
};

// Individual DOM update methods (like Knockout updates individual bindings)
PopupViewModel.prototype.updatePlayButton = function(tabId, isPlaying) {
  var btn = document.querySelector("[data-tab-id=\"" + tabId + "\"].player-controls-button-play");
  if (btn) {
    var icon = btn.querySelector("i");
    icon.textContent = isPlaying ? "pause_arrow" : "play_arrow";
    btn.title = isPlaying ? "Pause" : "Play";
  }
};

PopupViewModel.prototype.updateSongText = function(tabId, songText) {
  var container = document.querySelector("[data-tab-id=\"" + tabId + "\"]").closest(".site-tab-container");
  if (container) {
    var songDiv = container.querySelector(".song-data");
    if (songText) {
      if (!songDiv) {
        var playerRow = container.querySelector(".player-row");
        playerRow.insertAdjacentHTML("beforeend", "<div class=\"marquee song-data\"><p class=\"song-text\">" + songText + "</p></div>");
      } else {
        songDiv.querySelector(".song-text").textContent = songText;
      }
    } else if (songDiv) {
      songDiv.remove();
    }
  }
};

PopupViewModel.prototype.updateTabEnabledState = function(tabId, enabled) {
  var container = document.querySelector("[data-tab-id=\"" + tabId + "\"]").closest(".site-tab-container");
  if (container) {
    if (enabled) {
      container.classList.remove("disabled");
    } else {
      container.classList.add("disabled");
    }

    var toggleBtn = container.querySelector(".player-controls-button-toggle");
    if (toggleBtn) {
      if (enabled) {
        toggleBtn.classList.remove("active");
      } else {
        toggleBtn.classList.add("active");
      }
    }
  }
};

PopupViewModel.prototype.updatePriorityDisplay = function(tabId, priority) {
  var container = document.querySelector("[data-tab-id=\"" + tabId + "\"]").closest(".site-tab-container");
  if (container) {
    var priorityLabel = container.querySelector(".site-priority-label");
    var priorityText = container.querySelector(".priority-text");

    if (priorityLabel) priorityLabel.textContent = priority;
    if (priorityText) priorityText.textContent = priority;

    // Update button states
    var upBtn = container.querySelector(".priority-up");
    var downBtn = container.querySelector(".priority-down");

    if (upBtn) upBtn.disabled = priority >= 9;
    if (downBtn) downBtn.disabled = priority <= 1;
  }
};

// Get tab states (simplified like V2)
PopupViewModel.prototype.getTabStates = function(tabs) {
  var self = this;
  if (!tabs || (!tabs.enabled && !tabs.disabled)) {
    // Initialize empty UI
    self.renderEnabledTabs([]);
    return;
  }

  var enabledTabs = tabs.enabled || [];
  var disabledTabs = tabs.disabled || [];

  self.totalMusicTabs(enabledTabs.length + disabledTabs.length);

  // Process enabled tabs (exactly like V2)
  enabledTabs.forEach(function(tab) {
    chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, function(playerState) {
      if (chrome.runtime.lastError) {
        console.warn("Error getting player state for tab", tab.id, ":", chrome.runtime.lastError.message);
      } else {
        self.updateState(playerState, tab);
      }
      self.musicTabsLoaded(self.musicTabsLoaded.peek() + 1);
    });
  });

  // Process disabled tabs (exactly like V2)
  disabledTabs.forEach(function(tab) {
    chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, function(playerState) {
      if (chrome.runtime.lastError) {
        console.warn("Error getting player state for disabled tab", tab.id, ":", chrome.runtime.lastError.message);
      } else {
        self.updateState(playerState, tab, true);
      }
      self.musicTabsLoaded(self.musicTabsLoaded.peek() + 1);
    });
  });
};

// Render site tab HTML (same as before)
PopupViewModel.prototype.renderSiteTab = function(tab, isDisabled) {
  var songText = tab.songArtistText();
  var isPlaying = tab.isPlaying();
  var playIcon = isPlaying ? "pause_arrow" : "play_arrow";
  var disabledClass = (!tab.streamkeysEnabled() || isDisabled) ? "disabled" : "";

  var songHtml = songText ? "<div class=\"marquee song-data\"><p class=\"song-text\">" + songText + "</p></div>" : "";
  var prevBtnHtml = tab.canPlayPrev() ? "<button class=\"mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-prev " + (!tab.canPlayPrev() ? "mdl-button--disabled" : "") + "\" data-tab-id=\"" + tab.tabId + "\" title=\"Previous\"><i class=\"material-icons md-dark\">fast_rewind</i></button>" : "";
  var nextBtnHtml = tab.canPlayNext() ? "<button class=\"mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-next " + (!tab.canPlayNext() ? "mdl-button--disabled" : "") + "\" data-tab-id=\"" + tab.tabId + "\" title=\"Next\"><i class=\"material-icons md-dark\">fast_forward</i></button>" : "";

  return "" +
    "<div class=\"site-tab-container " + disabledClass + "\">" +
      "<div class=\"player-row player-container\">" +
        "<div class=\"site-data\">" +
          "<span class=\"site-priority-label\">" + tab.priority() + "</span>" +
          "<a tabindex=\"-1\" href=\"#\" class=\"site-link\" data-tab-id=\"" + tab.tabId + "\" title=\"Open Tab\">" +
            "<img class=\"site-favicon\" src=\"" + tab.faviconUrl + "\" onerror=\"this.style.display='none'\" />" +
            "<span class=\"site-title\">" + tab.siteName + "</span>" +
          "</a>" +
        "</div>" +
        songHtml +
      "</div>" +
      "<div class=\"player-controls-container player-container\">" +
        "<button class=\"mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-settings\" data-tab-id=\"" + tab.tabId + "\">" +
          "<i class=\"material-icons md-dark\">more_vert</i>" +
        "</button>" +
        prevBtnHtml +
        "<button class=\"mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-play\" data-tab-id=\"" + tab.tabId + "\" title=\"" + (isPlaying ? "Pause" : "Play") + "\">" +
          "<i class=\"material-icons md-dark\">" + playIcon + "</i>" +
        "</button>" +
        nextBtnHtml +
        "<button class=\"mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-toggle " + (!tab.streamkeysEnabled() ? "active" : "") + "\" data-tab-id=\"" + tab.tabId + "\" title=\"Toggle Extension\">" +
          "<i class=\"material-icons md-dark\">not_interested</i>" +
        "</button>" +
      "</div>" +
      "<div class=\"site-settings\" style=\"display: " + (tab.settingsOpen() ? "block" : "none") + "\">" +
        "<div class=\"settings-item left\">" +
          "<label class=\"control-label\">Priority</label>" +
          "<button class=\"mdl-button mdl-js-button mdl-button--icon priority-button priority-down\" data-tab-id=\"" + tab.tabId + "\" " + (tab.priority() <= 1 ? "disabled" : "") + ">" +
            "<i class=\"material-icons\">remove_circle</i>" +
          "</button>" +
          "<span class=\"priority-text\">" + tab.priority() + "</span>" +
          "<button class=\"mdl-button mdl-js-button mdl-button--icon priority-button priority-up\" data-tab-id=\"" + tab.tabId + "\" " + (tab.priority() >= 9 ? "disabled" : "") + ">" +
            "<i class=\"material-icons\">add_circle</i>" +
          "</button>" +
        "</div>" +
        "<div class=\"settings-item right\">" +
          "<button class=\"mdl-button mdl-button--raised mdl-button--colored advanced-settings-button\" data-tab-id=\"" + tab.tabId + "\">Advanced Settings</button>" +
        "</div>" +
      "</div>" +
    "</div>";
};

PopupViewModel.prototype.findTabById = function(tabId) {
  var allTabs = this.musicTabs.peek().concat(this.disabledMusicTabs.peek());
  return allTabs.find(function(tab) {
    return tab.tabId === tabId;
  });
};

// Event binding methods
PopupViewModel.prototype.bindDisabledToggle = function() {
  var self = this;
  var toggleBtn = document.getElementById("btn-disabled-sites");
  if (toggleBtn) {
    toggleBtn.onclick = function() {
      self.disabledSitesOpen(!self.disabledSitesOpen.peek());
    };
  }
};

PopupViewModel.prototype.bindTabEvents = function(container) {
  var self = this;

  // Bind site links
  container.querySelectorAll(".site-link").forEach(function(link) {
    link.onclick = function(e) {
      e.preventDefault();
      var tabId = parseInt(e.currentTarget.dataset.tabId);
      var tab = self.findTabById(tabId);
      if (tab) tab.openTab();
    };
  });

  // Bind control buttons
  container.querySelectorAll(".player-controls-button-play").forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      var tabId = parseInt(e.currentTarget.dataset.tabId);
      var tab = self.findTabById(tabId);
      if (tab && tab.streamkeysEnabled()) {
        tab.sendAction("playPause");
      }
    };
  });

  container.querySelectorAll(".player-controls-button-next").forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      var tabId = parseInt(e.currentTarget.dataset.tabId);
      var tab = self.findTabById(tabId);
      if (tab && tab.streamkeysEnabled()) {
        tab.sendAction("playNext");
      }
    };
  });

  container.querySelectorAll(".player-controls-button-prev").forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      var tabId = parseInt(e.currentTarget.dataset.tabId);
      var tab = self.findTabById(tabId);
      if (tab && tab.streamkeysEnabled()) {
        tab.sendAction("playPrev");
      }
    };
  });

  container.querySelectorAll(".player-controls-button-toggle").forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      var tabId = parseInt(e.currentTarget.dataset.tabId);
      var tab = self.findTabById(tabId);
      if (tab) {
        tab.toggleStreamkeysEnabled();
      }
    };
  });

  container.querySelectorAll(".player-controls-button-settings").forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      var tabId = parseInt(e.currentTarget.dataset.tabId);
      var tab = self.findTabById(tabId);
      if (tab) {
        tab.settingsOpen(!tab.settingsOpen.peek());
        // Re-render this specific tab
        var tabContainer = e.currentTarget.closest(".site-tab-container");
        var isDisabled = tabContainer.classList.contains("disabled");
        tabContainer.outerHTML = self.renderSiteTab(tab, isDisabled);
        self.bindTabEvents(tabContainer.parentElement);
      }
    };
  });

  // Bind priority buttons
  container.querySelectorAll(".priority-up").forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      var tabId = parseInt(e.currentTarget.dataset.tabId);
      var tab = self.findTabById(tabId);
      if (tab && tab.priority() < 9) {
        tab.priority(tab.priority.peek() + 1);
      }
    };
  });

  container.querySelectorAll(".priority-down").forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      var tabId = parseInt(e.currentTarget.dataset.tabId);
      var tab = self.findTabById(tabId);
      if (tab && tab.priority() > 1) {
        tab.priority(tab.priority.peek() - 1);
      }
    };
  });

  container.querySelectorAll(".advanced-settings-button").forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      self.openOptionsPage();
    };
  });
};

// Initialize when DOM is ready (exactly like V2)
document.addEventListener("DOMContentLoaded", function() {
  console.log("*** POPUP-MV3-AUTO.JS LOADED - AUTOMATIC DATA-BINDING MODE ***");
  window.popup = new PopupViewModel();

  // Bind footer links
  var optionsLink = document.getElementById("options-link");
  var helpLink = document.getElementById("help-link");
  var donateLink = document.getElementById("donate-link");

  if (optionsLink) {
    optionsLink.onclick = function(e) {
      e.preventDefault();
      window.popup.openOptionsPage();
    };
  }

  if (helpLink) {
    helpLink.onclick = function(e) {
      e.preventDefault();
      window.open("http://www.streamkeys.com/guide.html");
    };
  }

  if (donateLink) {
    donateLink.onclick = function(e) {
      e.preventDefault();
      window.open("http://www.streamkeys.com/donate.html");
    };
  }
});
