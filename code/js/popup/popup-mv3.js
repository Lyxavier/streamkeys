"use strict";

/* eslint-disable no-unused-vars */

// console.log("*** REACTIVE UI - NO FLICKER APPROACH ***");

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
    this.url = new Observable(data.url || "");
    this.siteKey = data.siteKey || "";
    this.song = new Observable(data.song || null);
    this.artist = new Observable(data.artist || null);
    this.enabled = new Observable(data.streamkeysEnabled !== undefined ? data.streamkeysEnabled : true);
    this.priority = new Observable(data.priority || 5);
    this.playing = new Observable(data.isPlaying || false);

    // FIXED: Proper button state defaults - use actual state values or sensible defaults
    this.canPlay = new Observable(data.canPlayPause !== undefined ? data.canPlayPause : true);
    this.canNext = new Observable(data.canPlayNext !== undefined ? data.canPlayNext : true);
    this.canPrev = new Observable(data.canPlayPrev !== undefined ? data.canPlayPrev : true);
    this.showSettings = new Observable(false);

    // Computed observables
    this.songText = new ComputedObservable(() => {
      const songVal = this.song.get();
      if (!songVal) return "";
      const artistVal = this.artist.get();
      return artistVal ? `${artistVal} - ${songVal}` : songVal;
    }, [this.song, this.artist]);

    this.playIcon = new ComputedObservable(() => {
      const isPlaying = this.playing.get();
      const icon = isPlaying ? "pause_arrow" : "play_arrow";
      // console.log(`Tab ${this.id} playIcon computed: isPlaying=${isPlaying}, icon=${icon}`); // DEBUG
      return icon;
    }, [this.playing]);

    // Auto-sync priority changes to background
    this.priority.subscribe((newPriority) => {
      chrome.runtime.sendMessage({
        action: "update_site_settings",
        siteKey: this.siteKey,
        siteState: { priority: newPriority }
      });
    });

    // console.log(`Created MusicTab ${this.id} with improved button defaults:`, {
    //   canPlay: this.canPlay.get(),
    //   canNext: this.canNext.get(),
    //   canPrev: this.canPrev.get(),
    //   playing: this.playing.get()
    // });
  }

  updateState(stateData) {
    // console.log("updateState called for tab", this.id, "with data:", stateData);

    // Store previous states for comparison (used in debug logging)
    const prevPlaying = this.playing.get(); // eslint-disable-line no-unused-vars
    const prevCanPlay = this.canPlay.get(); // eslint-disable-line no-unused-vars
    const prevCanNext = this.canNext.get(); // eslint-disable-line no-unused-vars
    const prevCanPrev = this.canPrev.get(); // eslint-disable-line no-unused-vars

    // Update only changed properties (reactive updates)
    if (stateData.song !== undefined) this.song.set(stateData.song);
    if (stateData.artist !== undefined) this.artist.set(stateData.artist);
    if (stateData.isPlaying !== undefined) {
      // console.log("Setting playing state to:", stateData.isPlaying, "for tab", this.id); // DEBUG
      this.playing.set(stateData.isPlaying);
    }

    // FIXED: Always update button capabilities, defaulting to true for basic functionality
    if (stateData.canPlayPause !== undefined) {
      this.canPlay.set(stateData.canPlayPause);
    } else {
      // If no capability info, assume basic controls are available
      this.canPlay.set(true);
    }

    if (stateData.canPlayNext !== undefined) {
      this.canNext.set(stateData.canPlayNext);
    } else {
      // If no capability info, assume basic controls are available
      this.canNext.set(true);
    }

    if (stateData.canPlayPrev !== undefined) {
      this.canPrev.set(stateData.canPlayPrev);
    } else {
      // If no capability info, assume basic controls are available
      this.canPrev.set(true);
    }

    // Log state changes for debugging
    // console.log("Tab", this.id, "state changes:", { // DEBUG
    // #!#   playing: `${prevPlaying} -> ${this.playing.get()}`,
    // #!#   canPlay: `${prevCanPlay} -> ${this.canPlay.get()}`,
    // #!#   canNext: `${prevCanNext} -> ${this.canNext.get()}`,
    // #!#   canPrev: `${prevCanPrev} -> ${this.canPrev.get()}`,
    // #!#   enabled: this.enabled.get()
    // #!# });

    // Force recomputation of computed observables immediately
    this.playIcon._recompute();
  }
}

// Observable array wrapper for reactive tab collections
class ObservableMap {
  constructor() {
    this._map = new Map();
    this._changeObservable = new Observable(0);
  }

  set(key, value) {
    this._map.set(key, value);
    this._changeObservable.set(this._changeObservable.get() + 1);
  }

  get(key) {
    return this._map.get(key);
  }

  delete(key) {
    const result = this._map.delete(key);
    if (result) {
      this._changeObservable.set(this._changeObservable.get() + 1);
    }
    return result;
  }

  values() {
    return this._map.values();
  }

  size() {
    return this._map.size;
  }

  subscribe(listener) {
    return this._changeObservable.subscribe(listener);
  }
}

// Main popup state
const PopupState = {
  tabs: new ObservableMap(),
  disabledTabs: new ObservableMap(),
  isLoading: new Observable(false), // Start as false, never show loading unless we have no content
  sortByPriority: new Observable(false), // New option for sorting preference (default: native tab order)
  expectedTabs: 0,
  loadedTabs: 0,
  hasShownInitialContent: false
};

// DOM binding utilities (similar to Knockout's data-bind)
function bindElement(element, observable, updateFn) {
  // console.log("bindElement called with:", element, "observable value:", observable.get()); // DEBUG
  // Initial update
  updateFn(observable.get());

  // Subscribe to changes
  return observable.subscribe((newValue) => {
    // console.log("bindElement observable changed to:", newValue, "for element:", element); // DEBUG
    updateFn(newValue);
  });
}

function bindText(element, observable) {
  return bindElement(element, observable, (value) => {
    // console.log("bindText updating element with value:", value, "element:", element); // DEBUG
    element.textContent = value || "";
  });
}

function bindMaterialIcon(element, observable) {
  return bindElement(element, observable, (iconName) => {
    // Simple MV2-style approach: just set the icon name as text
    element.textContent = iconName || "";
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

// Create DOM elements with reactive bindings (MV2-style structure)
function createTabElement(tab) {
  const container = document.createElement("div");
  container.className = "site-tab-container";
  container.dataset.tabId = tab.id;

  // Bind enabled/disabled state (MV2-style classes)
  bindClass(container, new ComputedObservable(() => !tab.enabled.get(), [tab.enabled]), "disabled");

  // Player row (matches MV2 structure)
  const playerRow = document.createElement("div");
  playerRow.className = "player-row player-container";

  // Site data (matches MV2 structure) - FIXED: Use correct MV2 class name
  const siteData = document.createElement("div");
  siteData.className = "site-data";

  const priorityLabel = document.createElement("span");
  priorityLabel.className = "site-priority-label";
  priorityLabel.style.display = "none"; // Hide priority number completely

  const siteLink = document.createElement("a");
  siteLink.href = "#";
  siteLink.className = "site-link";
  siteLink.tabIndex = -1;
  siteLink.title = "Open Tab";
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

  // Song data (matches MV2 structure with marquee)
  const songContainer = document.createElement("div");
  songContainer.className = "marquee song-data";

  const songText = document.createElement("p");
  songText.className = "song-text";

  // IMPROVED: Marquee scrolling functionality with proper overflow detection
  const updateSongText = (songContent) => {
    songText.textContent = songContent || "";

    // Remove any existing marquee
    const existingMarquee = songText.querySelector("marquee");
    if (existingMarquee) {
      songText.innerHTML = songContent || "";
    }

    // Only proceed if we have content
    if (!songContent) return;

    // Force layout to get accurate measurements
    songText.style.display = "block";
    songText.style.width = "auto";
    songText.style.whiteSpace = "nowrap";

    // Wait for next frame to ensure proper measurement
    requestAnimationFrame(() => {
      // Check if text actually overflows the container width (minus padding)
      const containerWidth = (document.querySelector("#player")?.clientWidth || 290) - 60; // Very conservative padding
      const textWidth = songText.scrollWidth;
      const actualOverflow = textWidth > containerWidth;

      // Only add marquee if text significantly overflows AND is long
      if (actualOverflow && songContent.length > 30) { // Lower threshold for better UX
        const content = songText.textContent;

        // Create CSS-based marquee with proper pausing
        songText.innerHTML = `<div class="song-text-marquee">${content}</div>`;
        songText.classList.add("song-text-container");

        const marqueeElement = songText.querySelector(".song-text-marquee");
        if (marqueeElement) {
          // FIXED: Calculate animation duration for CONSISTENT SPEED like MV2 marquee
          // Use pixels per second for consistent visual speed regardless of text length
          const pixelsPerSecond = 50; // Adjust for desired scroll speed
          const textPixelWidth = marqueeElement.scrollWidth || textWidth;
          const totalDistance = textPixelWidth + containerWidth; // From 100% right to 100% left
          const duration = Math.max(4, totalDistance / pixelsPerSecond); // Minimum 4s duration

          marqueeElement.style.animationDuration = `${duration}s`;

          let animationTimeout;
          let pauseTimeout;

          const startAnimation = () => {
            marqueeElement.classList.add("animate");
          };

          const stopAnimation = () => {
            marqueeElement.classList.remove("animate");
            // Reset position for next animation
            marqueeElement.style.transform = "translateX(100%)";
          };

          // Handle animation end and restart with pause
          marqueeElement.addEventListener("animationend", () => {
            stopAnimation();
            pauseTimeout = setTimeout(() => {
              if (songText.querySelector(".song-text-marquee")) {
                startAnimation();
              }
            }, 4000); // 4 second pause between loops
          });

          // Start first animation after 2 second initial pause
          animationTimeout = setTimeout(() => {
            startAnimation();
          }, 2000);

          // Cleanup function for when content changes
          marqueeElement._cleanup = () => {
            if (animationTimeout) clearTimeout(animationTimeout);
            if (pauseTimeout) clearTimeout(pauseTimeout);
            stopAnimation();
          };
        }
      } else {
        // Text doesn't overflow significantly, just use ellipsis
        songText.style.textOverflow = "ellipsis";
        songText.style.overflow = "hidden";
      }
    });
  };  bindElement(songText, tab.songText, updateSongText);

  songContainer.appendChild(songText);

  // Show/hide song container based on songText
  bindVisible(songContainer, new ComputedObservable(() => !!tab.songText.get(), [tab.songText]));

  playerRow.appendChild(siteData);
  playerRow.appendChild(songContainer);

  // Controls container (MV2-style with MDL classes)
  const controlsContainer = document.createElement("div");
  controlsContainer.className = "player-controls-container player-container";

  // Settings button (MV2-style) - FIXED: Add icon class like MV2
  const settingsBtn = document.createElement("button");
  settingsBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button settings-button";
  settingsBtn.innerHTML = "<i class=\"material-icons md-dark icon-more-vert\">more_vert</i>";
  settingsBtn.onclick = () => {
    tab.showSettings.set(!tab.showSettings.get());
  };
  controlsContainer.appendChild(settingsBtn);

  // Initialize MDL for the settings button
  if (typeof componentHandler !== "undefined") {
    componentHandler.upgradeElement(settingsBtn);
  }

  // Previous button (MV2-style) with FIXED property bindings
  const prevBtn = document.createElement("button");
  prevBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-prev";
  prevBtn.innerHTML = "<i class=\"material-icons md-dark icon-fast-rewind\">fast_rewind</i>";
  prevBtn.onclick = () => {
    // console.log("Previous button clicked for tab", tab.id); // DEBUG
    sendCommand(tab.id, "playPrev");
  };

  // FIXED: Use correct property names and ensure initial state is set
  bindClass(prevBtn, new ComputedObservable(() => {
    const canPrev = tab.canPrev.get();
    const enabled = tab.enabled.get();
    const shouldDisable = !canPrev || !enabled;
    // #!# // console.log(`Tab ${tab.id} prev button: canPrev=${canPrev}, enabled=${enabled}, shouldDisable=${shouldDisable}`);
    return shouldDisable;
  }, [tab.canPrev, tab.enabled]), "mdl-button--disabled");
  controlsContainer.appendChild(prevBtn);

  // Initialize MDL for the previous button
  if (typeof componentHandler !== "undefined") {
    componentHandler.upgradeElement(prevBtn);
  }

  // Play/pause button (MV2-style) with FIXED property bindings
  const playBtn = document.createElement("button");
  playBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-play";
  const playIcon = document.createElement("i");
  playIcon.className = "material-icons md-dark";
  bindMaterialIcon(playIcon, tab.playIcon);
  playBtn.appendChild(playIcon);
  playBtn.onclick = () => {
    const isEnabled = tab.enabled.get();
    const isPlaying = tab.playing.get();

    // For disabled sites: only allow pausing if currently playing, never allow starting playback
    if (!isEnabled && !isPlaying) {
      // #!# // console.log("Blocked site is not playing - preventing play action for tab", tab.id);
      return; // Don't send play command to disabled site that's not playing
    }

    // #!# // console.log("Play/pause button clicked for tab", tab.id, "current playing state:", isPlaying, "enabled:", isEnabled);

    // FIXED: Remove optimistic UI update to prevent multiple toggles
    sendCommand(tab.id, "playPause");

    // Refresh the actual state after a brief delay to get the real state
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
        if (!chrome.runtime.lastError && state && state.isPlaying !== undefined) {
          // #!# // console.log("Refreshing play state after command, got:", state.isPlaying);
          tab.playing.set(state.isPlaying);
        }
      });
    }, 150);
  };

  // MODIFIED: Updated play button disabled logic for blocked sites
  bindClass(playBtn, new ComputedObservable(() => {
    const canPlay = tab.canPlay.get();
    const enabled = tab.enabled.get();
    const isPlaying = tab.playing.get();

    // For disabled sites: only disable if not playing (allow pause, prevent play)
    if (!enabled) {
      const shouldDisable = !canPlay || !isPlaying; // Allow clicking when playing (to pause)
      // #!# // console.log(`Tab ${tab.id} play button (disabled site): canPlay=${canPlay}, enabled=${enabled}, isPlaying=${isPlaying}, shouldDisable=${shouldDisable}`);
      return shouldDisable;
    }

    // For enabled sites: original logic
    const shouldDisable = !canPlay || !enabled;
    // #!# // console.log(`Tab ${tab.id} play button (enabled site): canPlay=${canPlay}, enabled=${enabled}, shouldDisable=${shouldDisable}`);
    return shouldDisable;
  }, [tab.canPlay, tab.enabled, tab.playing]), "mdl-button--disabled");
  controlsContainer.appendChild(playBtn);

  // Initialize MDL for the play button
  if (typeof componentHandler !== "undefined") {
    componentHandler.upgradeElement(playBtn);
  }

  // Next button (MV2-style) with FIXED property bindings
  const nextBtn = document.createElement("button");
  nextBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-next";
  nextBtn.innerHTML = "<i class=\"material-icons md-dark icon-fast-forward\">fast_forward</i>";
  nextBtn.onclick = () => {
    // console.log("Next button clicked for tab", tab.id); // DEBUG
    sendCommand(tab.id, "playNext");
  };

  // FIXED: Use correct property names and ensure initial state is set
  bindClass(nextBtn, new ComputedObservable(() => {
    const canNext = tab.canNext.get();
    const enabled = tab.enabled.get();
    const shouldDisable = !canNext || !enabled;
    // #!# // console.log(`Tab ${tab.id} next button: canNext=${canNext}, enabled=${enabled}, shouldDisable=${shouldDisable}`);
    return shouldDisable;
  }, [tab.canNext, tab.enabled]), "mdl-button--disabled");
  controlsContainer.appendChild(nextBtn);

  // Initialize MDL for the next button
  if (typeof componentHandler !== "undefined") {
    componentHandler.upgradeElement(nextBtn);
  }

  // Toggle enabled button (MV2-style) - FIXED: Add icon class like MV2
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-toggle";
  toggleBtn.innerHTML = "<i class=\"material-icons md-dark icon-not-interested\">not_interested</i>";
  toggleBtn.onclick = () => {
    const newEnabled = !tab.enabled.get();
    tab.enabled.set(newEnabled);

    // FIXED: Don't move tabs between collections - keep all tabs in main collection
    // Just update the enabled state - the reactive UI will handle the visual changes
    // This prevents tabs from "disappearing" when disabled

    chrome.runtime.sendMessage({
      action: "toggle_enabled",
      tab_target: tab.id,
      enabled: newEnabled
    });

    // No need to call updateMainUI() - reactive updates handle this automatically
  };
  bindClass(toggleBtn, new ComputedObservable(() => !tab.enabled.get(), [tab.enabled]), "active");
  controlsContainer.appendChild(toggleBtn);

  // Initialize MDL for the toggle button
  if (typeof componentHandler !== "undefined") {
    componentHandler.upgradeElement(toggleBtn);
  }

  // Settings panel (MV2-style structure)
  const settingsPanel = document.createElement("div");
  settingsPanel.className = "site-settings initialize";
  bindVisible(settingsPanel, tab.showSettings);

  const settingsLeft = document.createElement("div");
  settingsLeft.className = "settings-item left";

  const priorityLabel2 = document.createElement("label");
  priorityLabel2.className = "control-label";
  priorityLabel2.textContent = "Priority";

  const priorityDown = document.createElement("button");
  priorityDown.className = "mdl-button mdl-js-button mdl-button--icon priority-button";
  priorityDown.innerHTML = "<i class=\"material-icons icon-remove-circle\">remove_circle</i>";
  priorityDown.onclick = () => {
    const current = tab.priority.get();
    if (current > 1) tab.priority.set(current - 1);
  };
  bindClass(priorityDown, new ComputedObservable(() => tab.priority.get() <= 1, [tab.priority]), "mdl-button--disabled");

  const priorityDisplay = document.createElement("span");
  priorityDisplay.className = "priority-text";
  bindText(priorityDisplay, tab.priority);

  const priorityUp = document.createElement("button");
  priorityUp.className = "mdl-button mdl-js-button mdl-button--icon priority-button";
  priorityUp.innerHTML = "<i class=\"material-icons icon-add-circle\">add_circle</i>";
  priorityUp.onclick = () => {
    const current = tab.priority.get();
    if (current < 9) tab.priority.set(current + 1);
  };
  bindClass(priorityUp, new ComputedObservable(() => tab.priority.get() >= 9, [tab.priority]), "mdl-button--disabled");

  settingsLeft.appendChild(priorityLabel2);
  settingsLeft.appendChild(priorityDown);
  settingsLeft.appendChild(priorityDisplay);
  settingsLeft.appendChild(priorityUp);

  // Initialize MDL for the priority buttons
  if (typeof componentHandler !== "undefined") {
    componentHandler.upgradeElement(priorityDown);
    componentHandler.upgradeElement(priorityUp);
  }

  const settingsRight = document.createElement("div");
  settingsRight.className = "settings-item right";

  const optionsBtn = document.createElement("button");
  optionsBtn.className = "mdl-button mdl-button--raised mdl-button--colored advanced-settings-button";
  optionsBtn.textContent = "Advanced Settings";
  optionsBtn.tabIndex = -1;
  optionsBtn.onclick = () => window.open(chrome.runtime.getURL("html/options.html"));

  settingsRight.appendChild(optionsBtn);

  // Initialize MDL for the options button
  if (typeof componentHandler !== "undefined") {
    componentHandler.upgradeElement(optionsBtn);
  }
  settingsPanel.appendChild(settingsLeft);
  settingsPanel.appendChild(settingsRight);

  container.appendChild(playerRow);
  container.appendChild(controlsContainer);
  container.appendChild(settingsPanel);

  return container;
}

// Main UI update function (reactive updates only - no DOM clearing)
function updateMainUI() {
  const player = document.getElementById("player");

  // FIXED: Show ALL tabs (enabled and disabled) in main view
  // Get all tabs from both collections
  const disabledTabsArray = PopupState.disabledTabs ? Array.from(PopupState.disabledTabs.values()) : [];
  const allTabs = [...Array.from(PopupState.tabs.values()), ...disabledTabsArray];

  // console.log(`updateMainUI: Processing ${allTabs.length} total tabs (${PopupState.tabs.size} enabled, ${disabledTabsArray.length} disabled)`);

  // Filter and sort all tabs together
  const displayTabs = allTabs
    .filter(tab => {
      // Safety check - ensure tab is a MusicTab instance with observables
      if (!tab || !tab.url || !tab.siteName || typeof tab.url.get !== "function") {
        // console.warn("Skipping invalid tab object:", {
        //   hasTab: !!tab,
        //   hasUrl: !!(tab && tab.url),
        //   hasSiteName: !!(tab && tab.siteName),
        //   hasUrlGet: !!(tab && tab.url && typeof tab.url.get === "function"),
        //   tabId: tab && tab.id,
        //   tabKeys: tab ? Object.keys(tab) : "no tab"
        // });
        return false;
      }
      const hasUrl = tab.url.get();
      const hasSiteName = tab.siteName.get();
      // console.log(`Tab ${tab.id}: url="${hasUrl}", siteName="${hasSiteName}"`);
      return hasUrl && hasSiteName; // Only show valid tabs with URL/siteName
    })
    .sort((a, b) => {
      if (PopupState.sortByPriority.get()) {
        // Priority-based sorting (MV3 enhancement)
        const aPriority = a.priority.get();
        const bPriority = b.priority.get();
        if (aPriority !== bPriority) return bPriority - aPriority;

        const aSiteName = a.siteName.get();
        const bSiteName = b.siteName.get();
        if (aSiteName !== bSiteName) return aSiteName.localeCompare(bSiteName);

        return a.id - b.id;
      } else {
        // Native tab order (MV2 behavior) - just by tab ID
        return a.id - b.id;
      }
    });

  // console.log(`updateMainUI: After filtering, ${displayTabs.length} tabs will be displayed`);

  // Never show loading - always show content immediately
  const hasAnyContent = PopupState.tabs.size() > 0 || (PopupState.disabledTabs && PopupState.disabledTabs.size() > 0);

  // Mark that we've shown initial content
  if (hasAnyContent) {
    PopupState.hasShownInitialContent = true;
  }

  // Remove any loading element if present
  const loadingElement = player.querySelector(".no-sites-loading");
  if (loadingElement) {
    loadingElement.remove();
  }

  // Show empty state only when NOT loading and no tabs exist
  if (displayTabs.length === 0 && !PopupState.isLoading.get()) {
    if (!player.querySelector(".no-sites-empty")) {
      // Don't clear if we have other content
      if (!player.hasChildNodes() || player.children.length === 0) {
        player.innerHTML = "";
      }
      const noSites = document.createElement("div");
      noSites.className = "no-sites no-sites-empty";
      noSites.textContent = "No music sites open.";
      player.appendChild(noSites);
    }
    return;
  }

  // Remove empty state if present
  const emptyElement = player.querySelector(".no-sites-empty");
  if (emptyElement) {
    emptyElement.remove();
  }

  // SIMPLIFIED: Always show all tabs in main view (both enabled and disabled)
  // Remove any old containers from the separation approach
  const enabledContainer = player.querySelector(".enabled-tabs-container");
  const disabledContainer = player.querySelector(".disabled-tabs-container");
  if (enabledContainer) enabledContainer.remove();
  if (disabledContainer) disabledContainer.remove();

  // Display all tabs in main area - disabled tabs will be visually distinguished by CSS
  updateTabElements(displayTabs);
}

// Create tab elements only once, then use reactive updates
function updateTabElements(tabs) {
  const player = document.getElementById("player");

  // SIMPLIFIED: No containers needed - add tabs directly to player
  // Remove any old containers
  const enabledContainer = player.querySelector(".enabled-tabs-container");
  const disabledContainer = player.querySelector(".disabled-tabs-container");
  if (enabledContainer) enabledContainer.remove();
  if (disabledContainer) disabledContainer.remove();

  // Add/update tab elements directly in player
  tabs.forEach(tab => {
    let existingElement = player.querySelector(`[data-tab-id="${tab.id}"]`);
    if (!existingElement) {
      existingElement = createTabElement(tab);
      player.appendChild(existingElement);
    }
    // Reactive updates happen automatically via observables
  });

  // Remove tabs that no longer exist
  const existingElements = player.querySelectorAll("[data-tab-id]");
  existingElements.forEach(element => {
    const tabId = parseInt(element.dataset.tabId);
    const stillExists = tabs.some(tab => tab.id === tabId);
    if (!stillExists) {
      element.remove();
    }
  });
}

// Dynamic tab creation/update (MV2-style approach)
function updatePopupState(stateData, fromTab) {
  if (!stateData || !fromTab) {
    // #!# // console.warn("updatePopupState called with invalid data:", { stateData, fromTab });
    return;
  }

  // Look for existing tab in both enabled and disabled collections
  let musicTab = PopupState.tabs.get(fromTab.id) || (PopupState.disabledTabs && PopupState.disabledTabs.get(fromTab.id));

  if (musicTab) {
    // Update existing tab's observables (reactive updates)
    musicTab.updateState(stateData);
    // console.log("Updated existing tab", fromTab.id, "with state:", stateData);
  } else {
    // CREATE NEW TAB DYNAMICALLY (like MV2 did)
    // console.log("Creating new dynamic tab", fromTab.id, "with state:", stateData);

    // First validate the tab still exists
    chrome.tabs.get(fromTab.id, () => {
      if (chrome.runtime.lastError) {
        // console.log("Tab", fromTab.id, "no longer exists during dynamic creation, skipping");
        return;
      }

      // Create new MusicTab with combined data
      // Use siteName from tab (now properly populated by Sitelist) or fallback to siteKey
      const siteName = fromTab.siteName || fromTab.streamkeysSiteKey || "Unknown Site";

      const tabData = Object.assign({}, stateData, {
        tabId: fromTab.id,
        url: fromTab.url || "",
        faviconUrl: fromTab.favIconUrl,
        siteName: siteName,
        siteKey: fromTab.streamkeysSiteKey,
        priority: fromTab.streamkeysPriority || 5,
        streamkeysEnabled: fromTab.streamkeysEnabled !== undefined ? fromTab.streamkeysEnabled : true
      });

      const newTab = new MusicTab(tabData);

      // FIXED: Always add tabs to main collection regardless of enabled state
      // The reactive UI will handle disabled styling automatically
      PopupState.tabs.set(fromTab.id, newTab);

      // Set up priority sync for this new tab (like MV2 did)
      newTab.priority.subscribe((newPriority) => {
        // Sync priority across tabs with same siteKey
        const disabledTabsArray = PopupState.disabledTabs ? Array.from(PopupState.disabledTabs.values()) : [];
        const allTabs = [...PopupState.tabs.values(), ...disabledTabsArray];
        allTabs.forEach(tab => {
          if (tab.siteKey === newTab.siteKey && tab.id !== newTab.id && tab.priority.get() !== newPriority) {
            tab.priority.set(newPriority);
          }
        });
      });

      // Trigger UI update for new tab
      updateMainUI();
    });
  }
}

// Tab cleanup for closed tabs (MV2-style)
function cleanupClosedTabs() {
  // Check if any tabs in our collections no longer exist
  const allTabIds = [...PopupState.tabs._map.keys()];
  allTabIds.forEach(tabId => {
    chrome.tabs.get(tabId, () => {
      if (chrome.runtime.lastError) {
        // Tab no longer exists, remove from collections
        // console.log("Removing closed tab", tabId, "from popup state");
        PopupState.tabs.delete(tabId);
      }
    });
  });
}

// Utility functions
function sendCommand(tabId, command) {
  chrome.runtime.sendMessage({
    action: "command",
    command: command,
    tab_target: tabId
  });
}

// Refresh current state for all active tabs (ensures UI is in sync)
function refreshCurrentStates() {
  // console.log("Refreshing current states for all active tabs");

  const disabledTabsArray = PopupState.disabledTabs ? Array.from(PopupState.disabledTabs.values()) : [];
  const allTabs = [...PopupState.tabs.values(), ...disabledTabsArray];

  allTabs.forEach(tab => {
    // Poll current state from each tab multiple times to ensure accuracy
    const refreshTab = () => {
      chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
        if (chrome.runtime.lastError) {
          // #!# // console.log(`Could not refresh state for tab ${tab.id}:`, chrome.runtime.lastError.message);
          return;
        }

        if (state) {
          // #!# // console.log(`Refreshed state for tab ${tab.id}:`, state);
          tab.updateState(state);
        }
      });
    };

    // Multiple quick refreshes for better button state accuracy
    refreshTab();                    // Immediate
    setTimeout(refreshTab, 50);      // Quick follow-up
    setTimeout(refreshTab, 200);     // Final check
  });
}

// Enhanced data loading with MV2-style cached states
function loadInitialData() {
  // NEVER show loading immediately - we want instant response
  // console.log("Loading initial data - no loading state will be shown");

  // ENHANCED: First try to get cached states from background for immediate UI
  chrome.runtime.sendMessage({ action: "get_cached_states" }, (cachedResponse) => {
    let cachedStates = {};
    if (cachedResponse && cachedResponse.tabStates) {
      cachedStates = cachedResponse.tabStates;
      // console.log("Got cached states for", Object.keys(cachedStates).length, "tabs");
    }

    chrome.runtime.sendMessage({ action: "get_music_tabs" }, (response) => {
      // Check for chrome.runtime.lastError
      if (chrome.runtime.lastError) {
        // console.warn("Error getting music tabs:", chrome.runtime.lastError.message);
        // Show empty state instead of error
        PopupState.isLoading.set(false);
        PopupState.hasShownInitialContent = true;
        updateMainUI();

        // Try again after a brief delay in case it was a temporary service worker restart
        setTimeout(() => {
          // console.log("Retrying music tabs request after error...");
          loadInitialData();
        }, 1000);
        return;
      }

      // console.log("Popup received music tabs response:", response);

      if (!response || (!response.enabled && !response.disabled)) {
        // No tabs to load, don't show loading (like MV2)
        PopupState.isLoading.set(false);
        updateMainUI();
        return;
      }

      const enabled = response.enabled || [];
      const disabled = response.disabled || [];

      // console.log(`Popup loading: ${enabled.length} enabled tabs, ${disabled.length} disabled tabs`);

      PopupState.expectedTabs = enabled.length + disabled.length;
      PopupState.loadedTabs = 0;

      // console.log(`Expected tabs: ${PopupState.expectedTabs} (enabled: ${enabled.length})`);

      // NEVER show loading if we already have content or no tabs to load
      if (PopupState.expectedTabs === 0) {
        // console.log("No tabs to load, completing immediately");
        PopupState.hasShownInitialContent = true;
        checkLoadingComplete();
        return;
      }

      // Process tabs immediately without any loading state
      // console.log("Processing tabs without loading indicator");
      PopupState.hasShownInitialContent = true;

      // Load enabled tabs with validation and cached state support
      enabled.forEach(tab => {
        chrome.tabs.get(tab.id, () => {
          if (chrome.runtime.lastError) {
            // console.log("Tab", tab.id, "no longer exists, skipping");
            PopupState.loadedTabs++;
            checkLoadingComplete();
            return;
          }

          // ENHANCED: Check for cached state first for immediate display
          let initialState = null;
          if (cachedStates[tab.id] && cachedStates[tab.id].state) {
            initialState = cachedStates[tab.id].state;
            // console.log("Using cached state for tab", tab.id, ":", initialState);
          }

          // ALWAYS create a MusicTab object for tabs returned by service worker
          // Service worker already validated these are music sites
          const siteName = tab.siteName || (initialState && initialState.siteName) || tab.streamkeysSiteKey || "Unknown Site";
          const tabData = {
            tabId: tab.id,
            url: tab.url || "",
            faviconUrl: tab.favIconUrl,
            siteName: siteName,
            siteKey: tab.streamkeysSiteKey,
            priority: tab.streamkeysPriority || 5,
            streamkeysEnabled: tab.streamkeysEnabled !== undefined ? tab.streamkeysEnabled : true,
            // Use cached state if available, otherwise defaults
            ...(initialState || {
              song: "Loading...",
              artist: "",
              isPlaying: false,
              canPlayPause: false,
              canPrevious: false,
              canNext: false
            })
          };
          // console.log(`Creating MusicTab for ${tab.id} with siteName: ${siteName}`);
          PopupState.tabs.set(tab.id, new MusicTab(tabData));

          // Now get live state to update the cached data
          // Add a timeout for tab connections to prevent hanging
          let connectionHandled = false;
          const connectionTimeout = setTimeout(() => {
            if (!connectionHandled) {
              // console.warn("Connection timeout for tab", tab.id, "- tab may not have controller loaded yet");
              connectionHandled = true;
              PopupState.loadedTabs++;
              checkLoadingComplete();
            }
          }, 3000); // 3 second timeout

          chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
            if (!connectionHandled) {
              clearTimeout(connectionTimeout);
              connectionHandled = true;

              if (chrome.runtime.lastError) {
                // More specific error handling - reduce console noise for normal cases
                const error = chrome.runtime.lastError.message;
                if (error.includes("Could not establish connection")) {
                  // #!# // console.log("Tab", tab.id, "- content script not loaded, skipping (not a music site or controller failed)");
                } else if (error.includes("message port closed")) {
                  // #!# // console.log("Tab", tab.id, "- tab closed or navigated away");
                } else {
                  // console.warn("Unexpected error getting player state for tab", tab.id, ":", error);
                }

                // DO NOT create default tabs for connection errors - only background script should identify music sites
                PopupState.loadedTabs++;
                checkLoadingComplete();
                return;
              } else if (state) {
                // Update the tab we just created with live state
                let existingTab = PopupState.tabs.get(tab.id);
                if (existingTab) {
                  // console.log(`Updating tab ${tab.id} with live state:`, state);
                  existingTab.updateState(state);
                } else {
                  // console.warn(`Tab ${tab.id} responded but no MusicTab found - this should not happen`);
                }

                // FIXED: More aggressive immediate state refreshes with shorter delays
                const musicTab = PopupState.tabs.get(tab.id);
                if (musicTab) {
                  const refreshTab = () => {
                    chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
                      if (!chrome.runtime.lastError && state) {
                        musicTab.updateState(state);
                      }
                    });
                  };

                  // Multiple quick refreshes to catch controller state
                  setTimeout(refreshTab, 10);   // Very fast first refresh
                  setTimeout(refreshTab, 50);   // Second refresh
                  setTimeout(refreshTab, 150);  // Third refresh to catch delayed updates
                }
              } else {
                // console.log("No state returned for tab", tab.id, "- controller may not be ready");
              }

              PopupState.loadedTabs++;
              checkLoadingComplete();
            }
          });
        });
      });

      // Load disabled tabs with validation
      disabled.forEach(tab => {
        chrome.tabs.get(tab.id, () => {
          if (chrome.runtime.lastError) {
          // #!# // console.log("Disabled tab", tab.id, "no longer exists, skipping");
            PopupState.loadedTabs++;
            checkLoadingComplete();
            return;
          }

          // Add a timeout for tab connections to prevent hanging
          let connectionHandled = false;
          const connectionTimeout = setTimeout(() => {
            if (!connectionHandled) {
              // console.warn("Connection timeout for disabled tab", tab.id, "- tab may not have controller loaded yet");
              connectionHandled = true;
              PopupState.loadedTabs++;
              checkLoadingComplete();
            }
          }, 3000); // 3 second timeout

          chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
            if (!connectionHandled) {
              clearTimeout(connectionTimeout);
              connectionHandled = true;

              if (chrome.runtime.lastError) {
                // More specific error handling - reduce console noise for normal cases
                const error = chrome.runtime.lastError.message;
                if (error.includes("Could not establish connection")) {
                  // #!# // console.log("Tab", tab.id, "- content script not loaded, skipping (not a music site or controller failed)");
                } else if (error.includes("message port closed")) {
                  // #!# // console.log("Tab", tab.id, "- tab closed or navigated away");
                } else {
                  // console.warn("Unexpected error getting player state for tab", tab.id, ":", error);
                }

                // DO NOT create default tabs for connection errors - only background script should identify music sites
                PopupState.loadedTabs++;
                checkLoadingComplete();
                return;
              } else if (state) {
                // Update existing tab if we had cached state, or create new tab
                let existingTab = PopupState.tabs.get(tab.id);
                if (existingTab) {
                  existingTab.updateState(state);
                } else {
                  // Use proper fallback for siteName
                  const siteName = tab.siteName || state.siteName || tab.streamkeysSiteKey || "Unknown Site";

                  const tabData = Object.assign({}, state, {
                    tabId: tab.id,
                    url: tab.url || "",
                    faviconUrl: tab.favIconUrl,
                    siteName: siteName,
                    siteKey: tab.streamkeysSiteKey,
                    priority: tab.streamkeysPriority || 5,
                    streamkeysEnabled: tab.streamkeysEnabled !== undefined ? tab.streamkeysEnabled : true
                  });

                  PopupState.tabs.set(tab.id, new MusicTab(tabData));
                }

                // FIXED: More aggressive immediate state refreshes with shorter delays
                const refreshTab = () => {
                  chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
                    if (!chrome.runtime.lastError && state) {
                      const musicTab = PopupState.tabs.get(tab.id);
                      if (musicTab) {
                        // #!# // console.log("Immediate refresh for tab", tab.id, "with state:", state);
                        musicTab.updateState(state);
                      }
                    }
                  });
                };

                // Multiple quick refreshes to catch controller state
                setTimeout(refreshTab, 10);   // Very fast first refresh
                setTimeout(refreshTab, 50);   // Second refresh
                setTimeout(refreshTab, 150);  // Third refresh to catch delayed updates
              } else {
                // #!# // console.log("No state returned for tab", tab.id, "- controller may not be ready");
              }

              PopupState.loadedTabs++;
              checkLoadingComplete();
            }
          });
        });
      });

      // Load disabled tabs with similar caching support
      disabled.forEach(tab => {
        chrome.tabs.get(tab.id, () => {
          if (chrome.runtime.lastError) {
            PopupState.loadedTabs++;
            checkLoadingComplete();
            return;
          }

          // Check for cached state for disabled tabs too
          let initialState = null;
          if (cachedStates[tab.id] && cachedStates[tab.id].state) {
            initialState = cachedStates[tab.id].state;
            const siteName = tab.siteName || initialState.siteName || tab.streamkeysSiteKey || "Unknown Site";
            const tabData = Object.assign({}, initialState, {
              tabId: tab.id,
              url: tab.url || "",
              faviconUrl: tab.favIconUrl,
              siteName: siteName,
              siteKey: tab.streamkeysSiteKey,
              priority: tab.streamkeysPriority || 5,
              streamkeysEnabled: false // Mark as disabled
            });

            // FIXED: Put disabled tabs in main collection too
            PopupState.tabs.set(tab.id, new MusicTab(tabData));
          }

          chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
            if (chrome.runtime.lastError) {
              // More specific error handling - reduce console noise for normal cases
              const error = chrome.runtime.lastError.message;
              if (error.includes("Could not establish connection")) {
                // #!# // console.log("Disabled tab", tab.id, "- content script not loaded (expected for non-music sites)");
              } else if (error.includes("message port closed")) {
                // #!# // console.log("Disabled tab", tab.id, "- tab closed or navigated away");
              } else {
                // console.warn("Unexpected error getting player state for disabled tab", tab.id, ":", error);
              }
              // Don't create tab element for failed connections
            } else if (state) {
              // Update existing or create new disabled tab
              let existingTab = PopupState.tabs.get(tab.id); // Check main collection first
              if (!existingTab && PopupState.disabledTabs) {
                existingTab = PopupState.disabledTabs.get(tab.id);
              }

              if (existingTab) {
                existingTab.updateState(state);
              } else {
                // Use proper fallback for siteName
                const siteName = tab.siteName || state.siteName || tab.streamkeysSiteKey || "Unknown Site";

                const tabData = Object.assign({}, state, {
                  tabId: tab.id,
                  url: tab.url || "",
                  faviconUrl: tab.favIconUrl,
                  siteName: siteName,
                  siteKey: tab.streamkeysSiteKey,
                  priority: tab.streamkeysPriority || 5,
                  streamkeysEnabled: false // Mark as disabled
                });

                // FIXED: Put all tabs in main collection
                PopupState.tabs.set(tab.id, new MusicTab(tabData));
              }
            } else {
              // #!# // console.log("No state returned for disabled tab", tab.id, "- controller may not be ready");
            }

            PopupState.loadedTabs++;
            checkLoadingComplete();
          });
        });
      });
    });
  });
}

function checkLoadingComplete() {
  // #!# // console.log(`Loading check: ${PopupState.loadedTabs}/${PopupState.expectedTabs} tabs loaded`);
  // Only stop loading when we've processed all expected tabs (like MV2)
  if (PopupState.loadedTabs >= PopupState.expectedTabs) {
    // #!# // console.log("Loading complete, setting isLoading to false");
    PopupState.isLoading.set(false);
    PopupState.hasShownInitialContent = true; // Mark that we've shown content
    updateMainUI();
    setupReactiveUpdates();

    // Refresh current states immediately after initial load to fix button states
    setTimeout(() => {
      // #!# // console.log("Post-load state refresh to fix button states");
      refreshCurrentStates();
    }, 200); // Slightly longer delay to ensure everything is ready
  }
}

// Set up reactive updates for dynamic tab changes
function setupReactiveUpdates() {
  // Listen for loading state changes
  PopupState.isLoading.subscribe(() => updateMainUI());

  // Listen for tab collection changes (MV2-style reactive updates)
  PopupState.tabs.subscribe(() => {
    // #!# // console.log("Enabled tabs collection changed, updating UI");
    updateMainUI();
  });
  // No need to listen to individual tab changes since they're reactive via observables
  // The DOM elements are bound to observables and update automatically
}

// Initialize
document.addEventListener("DOMContentLoaded", function() {
  // console.log("*** INITIALIZING REACTIVE POPUP (NO FLICKER) ***");

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

  // Listen for real-time updates (MV2-style dynamic tab creation)
  chrome.runtime.onMessage.addListener((request) => {
    console.log("Popup received message:", request.action, request);
    if (request.action === "update_popup_state" && request.stateData) {
      updatePopupState(request.stateData, request.fromTab);
    } else if (request.action === "new_music_tab_detected" && request.tabData) {
      console.log("Popup: New music tab detected:", request.tabData);
      // Refresh popup data to include new tab (shorter delay since tab is confirmed ready)
      setTimeout(() => {
        console.log("Popup: Refreshing data for new tab...");
        loadInitialData();
      }, 500);
    }
  });

  // Set up periodic cleanup for closed tabs (every 5 seconds)
  setInterval(cleanupClosedTabs, 5000);

  // Refresh states when popup gains focus (user opens popup)
  window.addEventListener("focus", () => {
    // console.log("Popup gained focus, refreshing states");
    refreshCurrentStates();
  });

  // IMPROVED: Show empty state first, then load data without loading indicator unless needed
  updateMainUI(); // Show empty state immediately

  // Load sorting preference from storage
  chrome.storage.sync.get(["popup-sort-by-priority"], (result) => {
    const sortByPriority = result["popup-sort-by-priority"] || false;
    PopupState.sortByPriority.set(sortByPriority);
  });

  // Subscribe to sorting preference changes to update UI
  PopupState.sortByPriority.subscribe(() => {
    updateMainUI(); // Re-sort and update UI when preference changes
  });  setTimeout(() => {
    loadInitialData();
  }, 10); // Minimal delay to ensure DOM is ready

  // console.log("*** REACTIVE POPUP INITIALIZED - ZERO FLICKER ***");
});

