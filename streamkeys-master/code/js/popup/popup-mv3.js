"use strict";

console.log("*** INCREMENTAL DOM UPDATE POPUP - NO FLICKER ***");

// Global state tracking
let State = {
  tabs: new Map(), // Use Map for O(1) lookups
  disabledTabs: new Map(),
  isLoading: true,
  showDisabled: false,
  expectedTabs: 0,
  loadedTabs: 0
};

// DOM element registry to avoid re-queries
let DOMCache = {
  player: null,
  noSites: null,
  enabledContainer: null,
  disabledToggle: null,
  disabledContainer: null
};

// Initialize DOM structure once
function initializeDOM() {
  DOMCache.player = document.getElementById("player");

  // Create permanent containers to avoid innerHTML replacement
  DOMCache.noSites = document.createElement("div");
  DOMCache.noSites.className = "no-sites";
  DOMCache.noSites.textContent = "No music sites open.";
  DOMCache.noSites.style.display = "none";

  DOMCache.enabledContainer = document.createElement("div");
  DOMCache.enabledContainer.id = "enabled-container";

  DOMCache.disabledToggle = document.createElement("button");
  DOMCache.disabledToggle.className = "mdl-button mdl-js-button mdl-button--raised mdl-button--colored";
  DOMCache.disabledToggle.style.display = "none";
  DOMCache.disabledToggle.onclick = toggleDisabledSites;

  DOMCache.disabledContainer = document.createElement("div");
  DOMCache.disabledContainer.className = "disabled-site-tab-container";
  DOMCache.disabledContainer.style.display = "none";

  // Add all containers to DOM once
  DOMCache.player.innerHTML = ""; // Clear loading message
  DOMCache.player.appendChild(DOMCache.noSites);
  DOMCache.player.appendChild(DOMCache.enabledContainer);
  DOMCache.player.appendChild(DOMCache.disabledToggle);
  DOMCache.player.appendChild(DOMCache.disabledContainer);
}

// Individual tab DOM creation (only called once per tab)
function createTabElement(tab) {
  const container = document.createElement("div");
  container.className = "site-tab-container";
  container.dataset.tabId = tab.id;

  const playerRow = document.createElement("div");
  playerRow.className = "player-row player-container";

  const siteData = document.createElement("div");
  siteData.className = "site-data";

  const priorityLabel = document.createElement("span");
  priorityLabel.className = "site-priority-label";

  const siteLink = document.createElement("a");
  siteLink.href = "#";
  siteLink.className = "site-link";
  siteLink.onclick = () => openTab(tab.id);

  const favicon = document.createElement("img");
  favicon.className = "site-favicon";
  favicon.onerror = () => favicon.style.display = "none";

  const siteTitle = document.createElement("span");
  siteTitle.className = "site-title";

  const songData = document.createElement("div");
  songData.className = "marquee song-data";
  const songText = document.createElement("p");
  songText.className = "song-text";
  songData.appendChild(songText);

  siteLink.appendChild(favicon);
  siteLink.appendChild(siteTitle);
  siteData.appendChild(priorityLabel);
  siteData.appendChild(siteLink);
  playerRow.appendChild(siteData);
  playerRow.appendChild(songData);

  // Controls
  const controlsContainer = document.createElement("div");
  controlsContainer.className = "player-controls-container player-container";

  const settingsBtn = createButton("more_vert", () => toggleSettings(tab.id));
  const playBtn = createButton("play_arrow", () => sendAction(tab.id, "playPause"));
  const prevBtn = createButton("fast_rewind", () => sendAction(tab.id, "playPrev"));
  const nextBtn = createButton("fast_forward", () => sendAction(tab.id, "playNext"));
  const toggleBtn = createButton("not_interested", () => toggleEnabled(tab.id));

  controlsContainer.appendChild(settingsBtn);
  controlsContainer.appendChild(prevBtn);
  controlsContainer.appendChild(playBtn);
  controlsContainer.appendChild(nextBtn);
  controlsContainer.appendChild(toggleBtn);

  // Settings panel
  const settingsPanel = document.createElement("div");
  settingsPanel.className = "site-settings";
  settingsPanel.style.display = "none";

  const settingsLeft = document.createElement("div");
  settingsLeft.className = "settings-item left";

  const priorityLabel2 = document.createElement("label");
  priorityLabel2.textContent = "Priority";

  const priorityDown = createButton("remove_circle", () => adjustPriority(tab.id, -1));
  const priorityText = document.createElement("span");
  const priorityUp = createButton("add_circle", () => adjustPriority(tab.id, 1));

  settingsLeft.appendChild(priorityLabel2);
  settingsLeft.appendChild(priorityDown);
  settingsLeft.appendChild(priorityText);
  settingsLeft.appendChild(priorityUp);

  const settingsRight = document.createElement("div");
  settingsRight.className = "settings-item right";
  const advancedBtn = document.createElement("button");
  advancedBtn.className = "mdl-button mdl-button--raised mdl-button--colored";
  advancedBtn.textContent = "Advanced Settings";
  advancedBtn.onclick = openOptions;
  settingsRight.appendChild(advancedBtn);

  settingsPanel.appendChild(settingsLeft);
  settingsPanel.appendChild(settingsRight);

  container.appendChild(playerRow);
  container.appendChild(controlsContainer);
  container.appendChild(settingsPanel);

  // Store references for fast updates
  container._refs = {
    priorityLabel,
    favicon,
    siteTitle,
    songData,
    songText,
    playBtn,
    prevBtn,
    nextBtn,
    toggleBtn,
    settingsPanel,
    priorityText,
    priorityDown,
    priorityUp
  };

  return container;
}

function createButton(icon, onclick) {
  const btn = document.createElement("button");
  btn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button";
  const iconEl = document.createElement("i");
  iconEl.className = "material-icons md-dark";
  iconEl.textContent = icon;
  btn.appendChild(iconEl);
  btn.onclick = onclick;
  btn._icon = iconEl;
  return btn;
}

// Update individual tab (no DOM reconstruction)
function updateTabElement(element, tab) {
  const refs = element._refs;

  // Update only changed values
  if (refs.priorityLabel.textContent !== tab.priority.toString()) {
    refs.priorityLabel.textContent = tab.priority;
  }

  if (refs.favicon.src !== tab.favicon) {
    refs.favicon.src = tab.favicon;
  }

  if (refs.siteTitle.textContent !== tab.siteName) {
    refs.siteTitle.textContent = tab.siteName;
  }

  const songText = tab.songText || "";
  if (refs.songText.textContent !== songText) {
    refs.songText.textContent = songText;
    refs.songData.style.display = songText ? "block" : "none";
  }

  // Update play button icon
  const playIcon = tab.playing ? "pause_arrow" : "play_arrow";
  if (refs.playBtn._icon.textContent !== playIcon) {
    refs.playBtn._icon.textContent = playIcon;
  }

  // Update button states
  refs.prevBtn.style.display = tab.canPrev ? "inline-block" : "none";
  refs.nextBtn.style.display = tab.canNext ? "inline-block" : "none";

  // Update disabled state
  const shouldBeDisabled = !tab.enabled;
  const isDisabled = element.classList.contains("disabled");
  if (shouldBeDisabled !== isDisabled) {
    element.classList.toggle("disabled", shouldBeDisabled);
    refs.toggleBtn.classList.toggle("active", shouldBeDisabled);
  }

  // Update settings visibility
  const settingsVisible = tab.showSettings;
  const settingsDisplayed = refs.settingsPanel.style.display === "block";
  if (settingsVisible !== settingsDisplayed) {
    refs.settingsPanel.style.display = settingsVisible ? "block" : "none";
  }

  // Update priority controls
  if (refs.priorityText.textContent !== tab.priority.toString()) {
    refs.priorityText.textContent = tab.priority;
    refs.priorityDown.disabled = tab.priority <= 1;
    refs.priorityUp.disabled = tab.priority >= 9;
  }
}

// Smart DOM updates - only add/remove/update what changed
function updateDOM() {
  console.log("*** INCREMENTAL DOM UPDATE ***");

  const enabledTabs = Array.from(State.tabs.values())
    .filter(tab => tab.canPlay)
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.siteName !== b.siteName) return a.siteName.localeCompare(b.siteName);
      return a.id - b.id;
    });

  // Show/hide no sites message
  const shouldShowNoSites = !State.isLoading && enabledTabs.length === 0 && State.disabledTabs.size === 0;
  if ((DOMCache.noSites.style.display === "none") !== !shouldShowNoSites) {
    DOMCache.noSites.style.display = shouldShowNoSites ? "block" : "none";
  }

  // Update enabled tabs container
  updateTabContainer(DOMCache.enabledContainer, enabledTabs);

  // Update disabled toggle
  const hasDisabled = State.disabledTabs.size > 0 && !State.isLoading;
  if ((DOMCache.disabledToggle.style.display === "none") !== !hasDisabled) {
    DOMCache.disabledToggle.style.display = hasDisabled ? "block" : "none";

    if (hasDisabled) {
      const toggleText = State.showDisabled ? "Hide Disabled Sites" : "Show Disabled Sites";
      const toggleIcon = State.showDisabled ? "arrow_drop_up" : "arrow_drop_down";

      DOMCache.disabledToggle.innerHTML = `<span>${toggleText}</span><i class="material-icons">${toggleIcon}</i>`;
    }
  }

  // Update disabled container
  if (hasDisabled) {
    const shouldShowDisabled = State.showDisabled;
    if ((DOMCache.disabledContainer.style.display === "none") !== !shouldShowDisabled) {
      DOMCache.disabledContainer.style.display = shouldShowDisabled ? "block" : "none";
    }

    if (shouldShowDisabled) {
      const disabledTabs = Array.from(State.disabledTabs.values());
      updateTabContainer(DOMCache.disabledContainer, disabledTabs);
    }
  }
}

// Update a tab container with minimal DOM changes
function updateTabContainer(container, tabs) {
  const existingElements = Array.from(container.children);
  const newIds = tabs.map(tab => tab.id);

  // Remove elements for tabs that no longer exist
  existingElements.forEach(el => {
    const id = parseInt(el.dataset.tabId);
    if (!newIds.includes(id)) {
      container.removeChild(el);
    }
  });

  // Add or update elements
  tabs.forEach((tab, index) => {
    let element = container.querySelector(`[data-tab-id="${tab.id}"]`);

    if (!element) {
      // Create new element
      element = createTabElement(tab);

      // Insert at correct position
      const nextElement = container.children[index];
      if (nextElement) {
        container.insertBefore(element, nextElement);
      } else {
        container.appendChild(element);
      }
    } else {
      // Update existing element
      updateTabElement(element, tab);

      // Move to correct position if needed
      const currentIndex = Array.from(container.children).indexOf(element);
      if (currentIndex !== index) {
        const nextElement = container.children[index];
        if (nextElement) {
          container.insertBefore(element, nextElement);
        } else {
          container.appendChild(element);
        }
      }
    }
  });
}

// Tab data management
function createTab(data) {
  return {
    id: data.tabId,
    favicon: data.faviconUrl || "",
    siteName: data.siteName || "Unknown",
    siteKey: data.siteKey || "",
    song: data.song || null,
    artist: data.artist || null,
    enabled: data.streamkeysEnabled !== undefined ? data.streamkeysEnabled : true,
    priority: data.priority || 5,
    playing: data.isPlaying || false,
    canPlay: data.canPlayPause || false,
    canNext: data.canPlayNext || false,
    canPrev: data.canPlayPrev || false,
    showSettings: false,

    get songText() {
      if (!this.song) return "";
      return this.artist ? `${this.artist} - ${this.song}` : this.song;
    }
  };
}

// Action handlers
function openTab(tabId) {
  chrome.tabs.update(tabId, { active: true });
  window.close();
}

function sendAction(tabId, action) {
  const tab = State.tabs.get(tabId) || State.disabledTabs.get(tabId);
  if (tab && tab.enabled) {
    chrome.runtime.sendMessage({
      action: "command",
      command: action,
      tab_target: tabId
    });
  }
}

function toggleEnabled(tabId) {
  const tab = State.tabs.get(tabId) || State.disabledTabs.get(tabId);
  if (tab) {
    tab.enabled = !tab.enabled;
    chrome.runtime.sendMessage({
      action: "toggle_enabled",
      tab_target: tabId,
      enabled: tab.enabled
    });
    updateDOM();
  }
}

function toggleSettings(tabId) {
  const tab = State.tabs.get(tabId) || State.disabledTabs.get(tabId);
  if (tab) {
    tab.showSettings = !tab.showSettings;
    updateDOM();
  }
}

function adjustPriority(tabId, delta) {
  const tab = State.tabs.get(tabId) || State.disabledTabs.get(tabId);
  if (tab) {
    const newPriority = Math.max(1, Math.min(9, tab.priority + delta));
    if (newPriority !== tab.priority) {
      tab.priority = newPriority;
      chrome.runtime.sendMessage({
        action: "update_site_settings",
        siteKey: tab.siteKey,
        siteState: { priority: tab.priority }
      });
      updateDOM();
    }
  }
}

function toggleDisabledSites() {
  State.showDisabled = !State.showDisabled;
  updateDOM();
}

function openOptions() {
  window.open(chrome.runtime.getURL("html/options.html"));
}

// Data loading
function loadInitialData() {
  chrome.runtime.sendMessage({ action: "get_music_tabs" }, (response) => {
    if (!response || (!response.enabled && !response.disabled)) {
      State.isLoading = false;
      updateDOM();
      return;
    }

    const enabled = response.enabled || [];
    const disabled = response.disabled || [];

    State.expectedTabs = enabled.length + disabled.length;
    State.loadedTabs = 0;

    // Load enabled tabs
    enabled.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
        if (chrome.runtime.lastError) {
          console.warn("Error getting player state for tab", tab.id, ":", chrome.runtime.lastError.message);
          // Tab likely closed or unavailable, skip it
        } else if (state) {
          const tabData = Object.assign({}, state, {
            tabId: tab.id,
            faviconUrl: tab.favIconUrl,
            siteName: tab.siteName,
            siteKey: tab.streamkeysSiteKey,
            priority: tab.streamkeysPriority || 5,
            streamkeysEnabled: tab.streamkeysEnabled !== undefined ? tab.streamkeysEnabled : true
          });

          State.tabs.set(tab.id, createTab(tabData));
        }

        State.loadedTabs++;
        if (State.loadedTabs >= State.expectedTabs) {
          State.isLoading = false;
          updateDOM();
        }
      });
    });

    // Load disabled tabs
    disabled.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
        if (chrome.runtime.lastError) {
          console.warn("Error getting player state for disabled tab", tab.id, ":", chrome.runtime.lastError.message);
          // Tab likely closed or unavailable, skip it
        } else if (state) {
          const tabData = Object.assign({}, state, {
            tabId: tab.id,
            faviconUrl: tab.favIconUrl,
            siteName: tab.siteName,
            siteKey: tab.streamkeysSiteKey,
            priority: tab.streamkeysPriority || 5,
            streamkeysEnabled: tab.streamkeysEnabled !== undefined ? tab.streamkeysEnabled : true
          });

          State.disabledTabs.set(tab.id, createTab(tabData));
        }

        State.loadedTabs++;
        if (State.loadedTabs >= State.expectedTabs) {
          State.isLoading = false;
          updateDOM();
        }
      });
    });
  });
}

// Initialize
document.addEventListener("DOMContentLoaded", function() {
  console.log("*** INITIALIZING INCREMENTAL DOM POPUP ***");

  initializeDOM();

  // Bind footer
  document.getElementById("options-link").onclick = openOptions;
  document.getElementById("help-link").onclick = () => window.open("http://www.streamkeys.com/guide.html");
  document.getElementById("donate-link").onclick = () => window.open("http://www.streamkeys.com/donate.html");

  // Listen for real-time updates
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "update_popup_state" && request.stateData) {
      // Update individual tab data without full rebuild
      const tab = State.tabs.get(request.fromTab.id) || State.disabledTabs.get(request.fromTab.id);
      if (tab) {
        Object.assign(tab, request.stateData);
        updateDOM();
      }
    }
  });

  loadInitialData();

  console.log("*** INCREMENTAL DOM POPUP INITIALIZED ***");
});
