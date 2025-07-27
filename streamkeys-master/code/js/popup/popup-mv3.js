"use strict";

console.log("*** REACTIVE UI - NO FLICKER APPROACH ***");

// Lightweight reactive system (inspired by MV2's Knockout observables)
class Observable {
  constructor(initialValue) {
    this._value = initialValue;
    this._listeners = [];
  }

  get() {
    return this._value;
  }

  set(newValue) {
    if (this._value !== newValue) {
      this._value = newValue;
      this._listeners.forEach(listener => listener(newValue));
    }
  }

  subscribe(listener) {
    this._listeners.push(listener);
    return () => {
      const index = this._listeners.indexOf(listener);
      if (index > -1) this._listeners.splice(index, 1);
    };
  }
}

class ComputedObservable extends Observable {
  constructor(computeFn, dependencies = []) {
    super(null);
    this._computeFn = computeFn;
    this._dependencies = dependencies;

    // Subscribe to dependencies
    dependencies.forEach(dep => {
      dep.subscribe(() => this._recompute());
    });

    this._recompute();
  }

  _recompute() {
    const newValue = this._computeFn();
    if (this._value !== newValue) {
      this._value = newValue;
      this._listeners.forEach(listener => listener(newValue));
    }
  }
}

// Music tab model with observables (like MV2 MusicTab)
class MusicTab {
  constructor(data) {
    // Observable properties (automatically trigger UI updates)
    this.id = data.tabId;
    this.favicon = new Observable(data.faviconUrl || "");
    this.siteName = new Observable(data.siteName || "Unknown");
    this.siteKey = data.siteKey || "";
    this.song = new Observable(data.song || null);
    this.artist = new Observable(data.artist || null);
    this.enabled = new Observable(data.streamkeysEnabled !== undefined ? data.streamkeysEnabled : true);
    this.priority = new Observable(data.priority || 5);
    this.playing = new Observable(data.isPlaying || false);
    this.canPlay = new Observable(data.canPlayPause || false);
    this.canNext = new Observable(data.canPlayNext || false);
    this.canPrev = new Observable(data.canPlayPrev || false);
    this.showSettings = new Observable(false);

    // Computed observables
    this.songText = new ComputedObservable(() => {
      const songVal = this.song.get();
      if (!songVal) return "";
      const artistVal = this.artist.get();
      return artistVal ? `${artistVal} - ${songVal}` : songVal;
    }, [this.song, this.artist]);

    this.playIcon = new ComputedObservable(() => {
      return this.playing.get() ? "pause_arrow" : "play_arrow";
    }, [this.playing]);

    // Auto-sync priority changes to background
    this.priority.subscribe((newPriority) => {
      chrome.runtime.sendMessage({
        action: "update_site_settings",
        siteKey: this.siteKey,
        siteState: { priority: newPriority }
      });
    });
  }

  updateState(stateData) {
    // Update only changed properties (reactive updates)
    if (stateData.song !== undefined) this.song.set(stateData.song);
    if (stateData.artist !== undefined) this.artist.set(stateData.artist);
    if (stateData.isPlaying !== undefined) this.playing.set(stateData.isPlaying);
    if (stateData.canPlayPause !== undefined) this.canPlay.set(stateData.canPlayPause);
    if (stateData.canPlayNext !== undefined) this.canNext.set(stateData.canPlayNext);
    if (stateData.canPlayPrev !== undefined) this.canPrev.set(stateData.canPlayPrev);
  }
}

// Main popup state
const PopupState = {
  tabs: new Map(),
  disabledTabs: new Map(),
  isLoading: new Observable(true),
  showDisabled: new Observable(false),
  expectedTabs: 0,
  loadedTabs: 0
};

// DOM binding utilities (similar to Knockout's data-bind)
function bindElement(element, observable, updateFn) {
  // Initial update
  updateFn(observable.get());

  // Subscribe to changes
  return observable.subscribe(updateFn);
}

function bindText(element, observable) {
  return bindElement(element, observable, (value) => {
    element.textContent = value || "";
  });
}

function bindClass(element, observable, className) {
  return bindElement(element, observable, (value) => {
    element.classList.toggle(className, !!value);
  });
}

function bindVisible(element, observable) {
  return bindElement(element, observable, (value) => {
    element.style.display = value ? "" : "none";
  });
}

function bindAttribute(element, observable, attributeName) {
  return bindElement(element, observable, (value) => {
    if (value !== null && value !== undefined) {
      element.setAttribute(attributeName, value);
    } else {
      element.removeAttribute(attributeName);
    }
  });
}

// Create DOM elements with reactive bindings (no innerHTML replacement)
function createTabElement(tab) {
  const container = document.createElement("div");
  container.className = "site-tab-container";
  container.dataset.tabId = tab.id;

  // Bind enabled/disabled state
  bindClass(container, tab.enabled, "enabled");
  bindClass(container, new ComputedObservable(() => !tab.enabled.get(), [tab.enabled]), "disabled");

  // Player row
  const playerRow = document.createElement("div");
  playerRow.className = "player-row player-container";

  // Site data
  const siteData = document.createElement("div");
  siteData.className = "site-data";

  const priorityLabel = document.createElement("span");
  priorityLabel.className = "site-priority-label";
  bindText(priorityLabel, tab.priority);

  const siteLink = document.createElement("a");
  siteLink.href = "#";
  siteLink.className = "site-link";
  siteLink.onclick = (e) => {
    e.preventDefault();
    chrome.tabs.update(tab.id, { active: true });
    window.close();
  };

  const favicon = document.createElement("img");
  favicon.className = "site-favicon";
  bindAttribute(favicon, tab.favicon, "src");
  favicon.onerror = () => favicon.style.display = "none";

  const siteTitle = document.createElement("span");
  siteTitle.className = "site-title";
  bindText(siteTitle, tab.siteName);

  siteLink.appendChild(favicon);
  siteLink.appendChild(siteTitle);
  siteData.appendChild(priorityLabel);
  siteData.appendChild(siteLink);

  // Song data (conditional)
  const songContainer = document.createElement("div");
  songContainer.className = "marquee song-data";

  const songText = document.createElement("p");
  songText.className = "song-text";
  bindText(songText, tab.songText);

  songContainer.appendChild(songText);

  // Show/hide song container based on songText
  bindVisible(songContainer, new ComputedObservable(() => !!tab.songText.get(), [tab.songText]));

  playerRow.appendChild(siteData);
  playerRow.appendChild(songContainer);

  // Controls container
  const controlsContainer = document.createElement("div");
  controlsContainer.className = "player-controls-container player-container";

  // Settings button
  const settingsBtn = document.createElement("button");
  settingsBtn.className = "control-btn";
  settingsBtn.innerHTML = "<i class=\"material-icons md-dark\">more_vert</i>";
  settingsBtn.onclick = () => {
    tab.showSettings.set(!tab.showSettings.get());
  };
  controlsContainer.appendChild(settingsBtn);

  // Previous button
  const prevBtn = document.createElement("button");
  prevBtn.className = "control-btn";
  prevBtn.innerHTML = "<i class=\"material-icons md-dark\">fast_rewind</i>";
  prevBtn.onclick = () => sendCommand(tab.id, "playPrev");
  bindVisible(prevBtn, tab.canPrev);
  controlsContainer.appendChild(prevBtn);

  // Play/pause button
  const playBtn = document.createElement("button");
  playBtn.className = "control-btn";
  const playIcon = playBtn.querySelector("i") || document.createElement("i");
  playIcon.className = "material-icons md-dark";
  if (!playBtn.contains(playIcon)) playBtn.appendChild(playIcon);
  bindText(playIcon, tab.playIcon);
  playBtn.onclick = () => sendCommand(tab.id, "playPause");
  controlsContainer.appendChild(playBtn);

  // Next button
  const nextBtn = document.createElement("button");
  nextBtn.className = "control-btn";
  nextBtn.innerHTML = "<i class=\"material-icons md-dark\">fast_forward</i>";
  nextBtn.onclick = () => sendCommand(tab.id, "playNext");
  bindVisible(nextBtn, tab.canNext);
  controlsContainer.appendChild(nextBtn);

  // Toggle enabled button
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "control-btn";
  toggleBtn.innerHTML = "<i class=\"material-icons md-dark\">not_interested</i>";
  toggleBtn.onclick = () => {
    const newEnabled = !tab.enabled.get();
    tab.enabled.set(newEnabled);
    chrome.runtime.sendMessage({
      action: "toggle_enabled",
      tab_target: tab.id,
      enabled: newEnabled
    });
  };
  bindClass(toggleBtn, new ComputedObservable(() => !tab.enabled.get(), [tab.enabled]), "active");
  controlsContainer.appendChild(toggleBtn);

  // Settings panel
  const settingsPanel = document.createElement("div");
  settingsPanel.className = "site-settings";
  bindVisible(settingsPanel, tab.showSettings);

  const settingsLeft = document.createElement("div");
  settingsLeft.className = "settings-item left";

  const priorityLabel2 = document.createElement("label");
  priorityLabel2.textContent = "Priority";

  const priorityDown = document.createElement("button");
  priorityDown.className = "control-btn";
  priorityDown.innerHTML = "<i class=\"material-icons\">remove_circle</i>";
  priorityDown.onclick = () => {
    const current = tab.priority.get();
    if (current > 1) tab.priority.set(current - 1);
  };
  bindAttribute(priorityDown, new ComputedObservable(() => tab.priority.get() <= 1, [tab.priority]), "disabled");

  const priorityDisplay = document.createElement("span");
  bindText(priorityDisplay, tab.priority);

  const priorityUp = document.createElement("button");
  priorityUp.className = "control-btn";
  priorityUp.innerHTML = "<i class=\"material-icons\">add_circle</i>";
  priorityUp.onclick = () => {
    const current = tab.priority.get();
    if (current < 9) tab.priority.set(current + 1);
  };
  bindAttribute(priorityUp, new ComputedObservable(() => tab.priority.get() >= 9, [tab.priority]), "disabled");

  settingsLeft.appendChild(priorityLabel2);
  settingsLeft.appendChild(priorityDown);
  settingsLeft.appendChild(priorityDisplay);
  settingsLeft.appendChild(priorityUp);

  const settingsRight = document.createElement("div");
  settingsRight.className = "settings-item right";

  const optionsBtn = document.createElement("button");
  optionsBtn.className = "mdl-button mdl-button--raised";
  optionsBtn.textContent = "Advanced Settings";
  optionsBtn.onclick = () => window.open(chrome.runtime.getURL("html/options.html"));

  settingsRight.appendChild(optionsBtn);
  settingsPanel.appendChild(settingsLeft);
  settingsPanel.appendChild(settingsRight);

  container.appendChild(playerRow);
  container.appendChild(controlsContainer);
  container.appendChild(settingsPanel);

  return container;
}

// Main UI update function (no DOM replacement, only reactive updates)
function updateMainUI() {
  const player = document.getElementById("player");

  // Clear existing content
  player.innerHTML = "";

  const enabledTabs = Array.from(PopupState.tabs.values())
    .filter(tab => tab.canPlay.get())
    .sort((a, b) => {
      const aPriority = a.priority.get();
      const bPriority = b.priority.get();
      if (aPriority !== bPriority) return bPriority - aPriority;

      const aSiteName = a.siteName.get();
      const bSiteName = b.siteName.get();
      if (aSiteName !== bSiteName) return aSiteName.localeCompare(bSiteName);

      return a.id - b.id;
    });

  if (PopupState.isLoading.get()) {
    const loading = document.createElement("div");
    loading.className = "no-sites";
    loading.textContent = "Loading...";
    player.appendChild(loading);
    return;
  }

  if (enabledTabs.length === 0 && PopupState.disabledTabs.size === 0) {
    const noSites = document.createElement("div");
    noSites.className = "no-sites";
    noSites.textContent = "No music sites open.";
    player.appendChild(noSites);
    return;
  }

  // Add enabled tabs
  enabledTabs.forEach(tab => {
    player.appendChild(createTabElement(tab));
  });

  // Add disabled section if needed
  if (PopupState.disabledTabs.size > 0) {
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "mdl-button mdl-js-button mdl-button--raised mdl-button--colored";

    const toggleText = document.createElement("span");
    const toggleIcon = document.createElement("i");
    toggleIcon.className = "material-icons";

    bindText(toggleText, new ComputedObservable(() =>
      PopupState.showDisabled.get() ? "Hide Disabled Sites" : "Show Disabled Sites",
    [PopupState.showDisabled]
    ));

    bindText(toggleIcon, new ComputedObservable(() =>
      PopupState.showDisabled.get() ? "arrow_drop_up" : "arrow_drop_down",
    [PopupState.showDisabled]
    ));

    toggleBtn.onclick = () => PopupState.showDisabled.set(!PopupState.showDisabled.get());

    toggleBtn.appendChild(toggleText);
    toggleBtn.appendChild(toggleIcon);
    player.appendChild(toggleBtn);

    const disabledContainer = document.createElement("div");
    disabledContainer.className = "disabled-site-tab-container";
    bindVisible(disabledContainer, PopupState.showDisabled);

    Array.from(PopupState.disabledTabs.values()).forEach(tab => {
      disabledContainer.appendChild(createTabElement(tab));
    });

    player.appendChild(disabledContainer);
  }
}

// Utility functions
function sendCommand(tabId, command) {
  chrome.runtime.sendMessage({
    action: "command",
    command: command,
    tab_target: tabId
  });
}

// Data loading with tab validation
function loadInitialData() {
  chrome.runtime.sendMessage({ action: "get_music_tabs" }, (response) => {
    if (!response || (!response.enabled && !response.disabled)) {
      PopupState.isLoading.set(false);
      updateMainUI();
      return;
    }

    const enabled = response.enabled || [];
    const disabled = response.disabled || [];

    PopupState.expectedTabs = enabled.length + disabled.length;
    PopupState.loadedTabs = 0;

    // Load enabled tabs with validation
    enabled.forEach(tab => {
      chrome.tabs.get(tab.id, () => {
        if (chrome.runtime.lastError) {
          console.log("Tab", tab.id, "no longer exists, skipping");
          PopupState.loadedTabs++;
          checkLoadingComplete();
          return;
        }

        chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
          if (chrome.runtime.lastError) {
            console.warn("Error getting player state for tab", tab.id, ":", chrome.runtime.lastError.message);
          } else if (state) {
            const tabData = Object.assign({}, state, {
              tabId: tab.id,
              faviconUrl: tab.favIconUrl,
              siteName: tab.siteName,
              siteKey: tab.streamkeysSiteKey,
              priority: tab.streamkeysPriority || 5,
              streamkeysEnabled: tab.streamkeysEnabled !== undefined ? tab.streamkeysEnabled : true
            });

            PopupState.tabs.set(tab.id, new MusicTab(tabData));
          }

          PopupState.loadedTabs++;
          checkLoadingComplete();
        });
      });
    });

    // Load disabled tabs with validation
    disabled.forEach(tab => {
      chrome.tabs.get(tab.id, () => {
        if (chrome.runtime.lastError) {
          console.log("Disabled tab", tab.id, "no longer exists, skipping");
          PopupState.loadedTabs++;
          checkLoadingComplete();
          return;
        }

        chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
          if (chrome.runtime.lastError) {
            console.warn("Error getting player state for disabled tab", tab.id, ":", chrome.runtime.lastError.message);
          } else if (state) {
            const tabData = Object.assign({}, state, {
              tabId: tab.id,
              faviconUrl: tab.favIconUrl,
              siteName: tab.siteName,
              siteKey: tab.streamkeysSiteKey,
              priority: tab.streamkeysPriority || 5,
              streamkeysEnabled: tab.streamkeysEnabled !== undefined ? tab.streamkeysEnabled : true
            });

            PopupState.disabledTabs.set(tab.id, new MusicTab(tabData));
          }

          PopupState.loadedTabs++;
          checkLoadingComplete();
        });
      });
    });
  });
}

function checkLoadingComplete() {
  if (PopupState.loadedTabs >= PopupState.expectedTabs) {
    PopupState.isLoading.set(false);
    updateMainUI();
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", function() {
  console.log("*** INITIALIZING REACTIVE POPUP (NO FLICKER) ***");

  // Bind footer links
  document.getElementById("options-link").onclick = () => {
    window.open(chrome.runtime.getURL("html/options.html"));
  };
  document.getElementById("help-link").onclick = () => {
    window.open("http://www.streamkeys.com/guide.html");
  };
  document.getElementById("donate-link").onclick = () => {
    window.open("http://www.streamkeys.com/donate.html");
  };

  // Listen for real-time updates (no DOM replacement)
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "update_popup_state" && request.stateData) {
      const tab = PopupState.tabs.get(request.fromTab.id) || PopupState.disabledTabs.get(request.fromTab.id);
      if (tab) {
        // Update only changed properties (reactive)
        tab.updateState(request.stateData);
      }
    }
  });

  loadInitialData();

  console.log("*** REACTIVE POPUP INITIALIZED - ZERO FLICKER ***");
});
