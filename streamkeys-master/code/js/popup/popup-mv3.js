"use strict";

// #!# console.log("*** REACTIVE UI - NO FLICKER APPROACH ***");

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

    // FIXED: Proper button state defaults - use actual state values or sensible defaults
    this.canPlay = new Observable(data.canPlayPause !== undefined ? data.canPlayPause : true);
    this.canNext = new Observable(data.canPlayNext !== undefined ? data.canPlayNext : true);
    this.canPrev = new Observable(data.canPlayPrev !== undefined ? data.canPlayPrev : true);
    this.canLike = new Observable(data.canLike || false);
    this.canDislike = new Observable(data.canDislike || false);
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
      const icon = isPlaying ? "pause" : "play_arrow";
      // #!# console.log(`Tab ${this.id} playIcon computed: isPlaying=${isPlaying}, icon=${icon}`);
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

    // #!# console.log(`Created MusicTab ${this.id} with improved button defaults:`, {
    // #!#   canPlay: this.canPlay.get(),
    // #!#   canNext: this.canNext.get(),
    // #!#   canPrev: this.canPrev.get(),
    // #!#   playing: this.playing.get()
    // #!# });
  }

  updateState(stateData) {
    // #!# console.log("updateState called for tab", this.id, "with data:", stateData);

    // Store previous states for comparison (used in debug logging)
    const prevPlaying = this.playing.get(); // eslint-disable-line no-unused-vars
    const prevCanPlay = this.canPlay.get(); // eslint-disable-line no-unused-vars
    const prevCanNext = this.canNext.get(); // eslint-disable-line no-unused-vars
    const prevCanPrev = this.canPrev.get(); // eslint-disable-line no-unused-vars

    // Update only changed properties (reactive updates)
    if (stateData.song !== undefined) this.song.set(stateData.song);
    if (stateData.artist !== undefined) this.artist.set(stateData.artist);
    if (stateData.isPlaying !== undefined) {
      // #!# console.log("Setting playing state to:", stateData.isPlaying, "for tab", this.id);
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

    if (stateData.canLike !== undefined) this.canLike.set(stateData.canLike);
    if (stateData.canDislike !== undefined) this.canDislike.set(stateData.canDislike);

    // Log state changes for debugging
    // #!# console.log("Tab", this.id, "state changes:", {
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
  showDisabled: new Observable(false),
  expectedTabs: 0,
  loadedTabs: 0,
  hasShownInitialContent: false
};

// DOM binding utilities (similar to Knockout's data-bind)
function bindElement(element, observable, updateFn) {
  // #!# console.log("bindElement called with:", element, "observable value:", observable.get());
  // Initial update
  updateFn(observable.get());

  // Subscribe to changes
  return observable.subscribe((newValue) => {
    // #!# console.log("bindElement observable changed to:", newValue, "for element:", element);
    updateFn(newValue);
  });
}

function bindText(element, observable) {
  return bindElement(element, observable, (value) => {
    // #!# console.log("bindText updating element with value:", value, "element:", element);
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

  // Site data (matches MV2 structure)
  const siteData = document.createElement("div");
  siteData.className = "site-data";

  const priorityLabel = document.createElement("span");
  priorityLabel.className = "site-priority-label";
  bindText(priorityLabel, tab.priority);

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
          // Calculate animation duration based on text length for consistent speed
          const textLength = content.length;
          const duration = Math.max(8, textLength * 0.1); // Minimum 8s, adjust based on length

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

  // Settings button (MV2-style) - FIXED: Proper centering
  const settingsBtn = document.createElement("button");
  settingsBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button settings-button";
  settingsBtn.innerHTML = "<i class=\"material-icons md-dark\">more_vert</i>";
  settingsBtn.onclick = () => {
    tab.showSettings.set(!tab.showSettings.get());
  };
  controlsContainer.appendChild(settingsBtn);

  // Dislike button (MV2-style) - COMMENTED OUT per user request
  // const dislikeBtn = document.createElement("button");
  // dislikeBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-dislike";
  // dislikeBtn.innerHTML = "<i class=\"material-icons md-dark\">thumb_down</i>";
  // dislikeBtn.onclick = () => sendCommand(tab.id, "dislike");
  // bindClass(dislikeBtn, new ComputedObservable(() => {
  //   const canDislike = tab.canDislike.get();
  //   const enabled = tab.enabled.get();
  //   const shouldDisable = !canDislike || !enabled;
  //   return shouldDisable;
  // }, [tab.canDislike, tab.enabled]), "mdl-button--disabled");
  // controlsContainer.appendChild(dislikeBtn);

  // Previous button (MV2-style) with FIXED property bindings
  const prevBtn = document.createElement("button");
  prevBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-prev";
  prevBtn.innerHTML = "<i class=\"material-icons md-dark\">fast_rewind</i>";
  prevBtn.onclick = () => {
    // #!# console.log("Previous button clicked for tab", tab.id);
    sendCommand(tab.id, "playPrev");
  };

  // FIXED: Use correct property names and ensure initial state is set
  bindClass(prevBtn, new ComputedObservable(() => {
    const canPrev = tab.canPrev.get();
    const enabled = tab.enabled.get();
    const shouldDisable = !canPrev || !enabled;
    // #!# console.log(`Tab ${tab.id} prev button: canPrev=${canPrev}, enabled=${enabled}, shouldDisable=${shouldDisable}`);
    return shouldDisable;
  }, [tab.canPrev, tab.enabled]), "mdl-button--disabled");
  controlsContainer.appendChild(prevBtn);

  // Play/pause button (MV2-style) with FIXED property bindings
  const playBtn = document.createElement("button");
  playBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-play";
  const playIcon = document.createElement("i");
  playIcon.className = "material-icons md-dark";
  bindText(playIcon, tab.playIcon);
  playBtn.appendChild(playIcon);
  playBtn.onclick = () => {
    // #!# console.log("Play/pause button clicked for tab", tab.id, "current playing state:", tab.playing.get());
    sendCommand(tab.id, "playPause");

    // Optimistically toggle the state for immediate UI feedback
    const currentState = tab.playing.get();
    tab.playing.set(!currentState);

    // Then refresh the actual state after a brief delay to get the real state
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
        if (!chrome.runtime.lastError && state && state.isPlaying !== undefined) {
          // #!# console.log("Refreshing play state after command, got:", state.isPlaying);
          tab.playing.set(state.isPlaying);
        }
      });
    }, 100);
  };

  // FIXED: Use correct property names and ensure initial state is set
  bindClass(playBtn, new ComputedObservable(() => {
    const canPlay = tab.canPlay.get();
    const enabled = tab.enabled.get();
    const shouldDisable = !canPlay || !enabled;
    // #!# console.log(`Tab ${tab.id} play button: canPlay=${canPlay}, enabled=${enabled}, shouldDisable=${shouldDisable}`);
    return shouldDisable;
  }, [tab.canPlay, tab.enabled]), "mdl-button--disabled");
  controlsContainer.appendChild(playBtn);

  // Next button (MV2-style) with FIXED property bindings
  const nextBtn = document.createElement("button");
  nextBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-next";
  nextBtn.innerHTML = "<i class=\"material-icons md-dark\">fast_forward</i>";
  nextBtn.onclick = () => {
    // #!# console.log("Next button clicked for tab", tab.id);
    sendCommand(tab.id, "playNext");
  };

  // FIXED: Use correct property names and ensure initial state is set
  bindClass(nextBtn, new ComputedObservable(() => {
    const canNext = tab.canNext.get();
    const enabled = tab.enabled.get();
    const shouldDisable = !canNext || !enabled;
    // #!# console.log(`Tab ${tab.id} next button: canNext=${canNext}, enabled=${enabled}, shouldDisable=${shouldDisable}`);
    return shouldDisable;
  }, [tab.canNext, tab.enabled]), "mdl-button--disabled");
  controlsContainer.appendChild(nextBtn);

  // Like button (MV2-style) - COMMENTED OUT per user request
  // const likeBtn = document.createElement("button");
  // likeBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button player-controls-button-like";
  // likeBtn.innerHTML = "<i class=\"material-icons md-dark\">thumb_up</i>";
  // likeBtn.onclick = () => sendCommand(tab.id, "like");
  // bindClass(likeBtn, new ComputedObservable(() => {
  //   const canLike = tab.canLike.get();
  //   const enabled = tab.enabled.get();
  //   const shouldDisable = !canLike || !enabled;
  //   return shouldDisable;
  // }, [tab.canLike, tab.enabled]), "mdl-button--disabled");
  // controlsContainer.appendChild(likeBtn);

  // Toggle enabled button (MV2-style)
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "mdl-button mdl-js-button mdl-button--icon player-controls-button";
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
  priorityDown.innerHTML = "<i class=\"material-icons\">remove_circle</i>";
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
  priorityUp.innerHTML = "<i class=\"material-icons\">add_circle</i>";
  priorityUp.onclick = () => {
    const current = tab.priority.get();
    if (current < 9) tab.priority.set(current + 1);
  };
  bindClass(priorityUp, new ComputedObservable(() => tab.priority.get() >= 9, [tab.priority]), "mdl-button--disabled");

  settingsLeft.appendChild(priorityLabel2);
  settingsLeft.appendChild(priorityDown);
  settingsLeft.appendChild(priorityDisplay);
  settingsLeft.appendChild(priorityUp);

  const settingsRight = document.createElement("div");
  settingsRight.className = "settings-item right";

  const optionsBtn = document.createElement("button");
  optionsBtn.className = "mdl-button mdl-button--raised mdl-button--colored advanced-settings-button";
  optionsBtn.textContent = "Advanced Settings";
  optionsBtn.tabIndex = -1;
  optionsBtn.onclick = () => window.open(chrome.runtime.getURL("html/options.html"));

  settingsRight.appendChild(optionsBtn);
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

  // Don't clear content - reactive updates only
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

  // Never show loading - always show content immediately
  const hasAnyContent = PopupState.tabs.size() > 0 || PopupState.disabledTabs.size() > 0;

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
  if (enabledTabs.length === 0 && PopupState.disabledTabs.size() === 0 && !PopupState.isLoading.get()) {
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

  // Create or update tab elements (reactive approach)
  updateTabElements(enabledTabs, false);
  updateDisabledSection();
}

// Create tab elements only once, then use reactive updates
function updateTabElements(tabs, isDisabled) {
  const player = document.getElementById("player");
  const containerClass = isDisabled ? "disabled-site-tab-container" : "enabled-tabs-container";

  let container = player.querySelector(`.${containerClass}`);
  if (!container && tabs.length > 0) {
    container = document.createElement("div");
    container.className = containerClass;
    if (isDisabled) {
      // Add "initialize" class for MV2 compatibility
      container.classList.add("initialize");
      // Insert disabled container after enabled tabs and toggle button
      const toggleBtn = player.querySelector("#btn-disabled-sites");
      if (toggleBtn) {
        toggleBtn.insertAdjacentElement("afterend", container);
      } else {
        player.appendChild(container);
      }
    } else {
      // Insert enabled container at the beginning
      player.insertBefore(container, player.firstChild);
    }
  }

  if (!container) return;

  // Add/update tab elements
  tabs.forEach(tab => {
    let existingElement = container.querySelector(`[data-tab-id="${tab.id}"]`);
    if (!existingElement) {
      existingElement = createTabElement(tab);
      // Add "disabled-site" class for disabled tabs (MV2 style)
      if (isDisabled) {
        existingElement.classList.add("disabled-site");
      }
      container.appendChild(existingElement);
    }
    // Reactive updates happen automatically via observables
  });

  // Remove tabs that no longer exist
  const existingElements = container.querySelectorAll("[data-tab-id]");
  existingElements.forEach(element => {
    const tabId = parseInt(element.dataset.tabId);
    const stillExists = tabs.some(tab => tab.id === tabId);
    if (!stillExists) {
      element.remove();
    }
  });

  // Remove container if empty
  if (container.children.length === 0) {
    container.remove();
  }
}

function updateDisabledSection() {
  const player = document.getElementById("player");
  const disabledTabs = Array.from(PopupState.disabledTabs.values());

  if (disabledTabs.length > 0) {
    // Create toggle button if it doesn't exist (MV2-style)
    let toggleBtn = player.querySelector(".toggle-disabled-btn");
    if (!toggleBtn) {
      toggleBtn = document.createElement("button");
      toggleBtn.id = "btn-disabled-sites";
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
    }

    // Update disabled tabs container
    updateTabElements(disabledTabs, true);

    // Bind visibility to the container
    const disabledContainer = player.querySelector(".disabled-site-tab-container");
    if (disabledContainer) {
      bindVisible(disabledContainer, PopupState.showDisabled);
    }
  } else {
    // Remove disabled section if no disabled tabs
    const toggleBtn = player.querySelector("#btn-disabled-sites");
    const disabledContainer = player.querySelector(".disabled-site-tab-container");
    if (toggleBtn) toggleBtn.remove();
    if (disabledContainer) disabledContainer.remove();
  }
}

// Dynamic tab creation/update (MV2-style approach)
function updatePopupState(stateData, fromTab) {
  if (!stateData || !fromTab) {
    // #!# console.warn("updatePopupState called with invalid data:", { stateData, fromTab });
    return;
  }

  // Look for existing tab in both enabled and disabled collections
  let musicTab = PopupState.tabs.get(fromTab.id) || PopupState.disabledTabs.get(fromTab.id);

  if (musicTab) {
    // Update existing tab's observables (reactive updates)
    musicTab.updateState(stateData);
    // #!# console.log("Updated existing tab", fromTab.id, "with state:", stateData);
  } else {
    // CREATE NEW TAB DYNAMICALLY (like MV2 did)
    // #!# console.log("Creating new dynamic tab", fromTab.id, "with state:", stateData);

    // First validate the tab still exists
    chrome.tabs.get(fromTab.id, () => {
      if (chrome.runtime.lastError) {
        // #!# console.log("Tab", fromTab.id, "no longer exists during dynamic creation, skipping");
        return;
      }

      // Create new MusicTab with combined data
      // Use siteName from tab (now properly populated by Sitelist) or fallback to siteKey
      const siteName = fromTab.siteName || fromTab.streamkeysSiteKey || "Unknown Site";

      const tabData = Object.assign({}, stateData, {
        tabId: fromTab.id,
        faviconUrl: fromTab.favIconUrl,
        siteName: siteName,
        siteKey: fromTab.streamkeysSiteKey,
        priority: fromTab.streamkeysPriority || 5,
        streamkeysEnabled: fromTab.streamkeysEnabled !== undefined ? fromTab.streamkeysEnabled : true
      });

      const newTab = new MusicTab(tabData);

      // Add to appropriate collection based on enabled state
      if (newTab.enabled.get()) {
        PopupState.tabs.set(fromTab.id, newTab);
        // #!# console.log("Added new enabled tab", fromTab.id, "to tabs collection");
      } else {
        PopupState.disabledTabs.set(fromTab.id, newTab);
        // #!# console.log("Added new disabled tab", fromTab.id, "to disabled collection");
      }

      // Set up priority sync for this new tab (like MV2 did)
      newTab.priority.subscribe((newPriority) => {
        // Sync priority across tabs with same siteKey
        const allTabs = [...PopupState.tabs.values(), ...PopupState.disabledTabs.values()];
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
  const allTabIds = [...PopupState.tabs._map.keys(), ...PopupState.disabledTabs._map.keys()];
  allTabIds.forEach(tabId => {
    chrome.tabs.get(tabId, () => {
      if (chrome.runtime.lastError) {
        // Tab no longer exists, remove from collections
        // #!# console.log("Removing closed tab", tabId, "from popup state");
        PopupState.tabs.delete(tabId);
        PopupState.disabledTabs.delete(tabId);
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
  // #!# console.log("Refreshing current states for all active tabs");

  const allTabs = [...PopupState.tabs.values(), ...PopupState.disabledTabs.values()];

  allTabs.forEach(tab => {
    // Poll current state from each tab multiple times to ensure accuracy
    const refreshTab = () => {
      chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
        if (chrome.runtime.lastError) {
          // #!# console.log(`Could not refresh state for tab ${tab.id}:`, chrome.runtime.lastError.message);
          return;
        }

        if (state) {
          // #!# console.log(`Refreshed state for tab ${tab.id}:`, state);
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

// Data loading with tab validation
function loadInitialData() {
  // NEVER show loading immediately - we want instant response
  // #!# console.log("Loading initial data - no loading state will be shown");

  chrome.runtime.sendMessage({ action: "get_music_tabs" }, (response) => {
    // Check for chrome.runtime.lastError
    if (chrome.runtime.lastError) {
      // #!# console.warn("Error getting music tabs:", chrome.runtime.lastError.message);
      // Show empty state instead of error
      PopupState.isLoading.set(false);
      PopupState.hasShownInitialContent = true;
      updateMainUI();

      // Try again after a brief delay in case it was a temporary service worker restart
      setTimeout(() => {
        // #!# console.log("Retrying music tabs request after error...");
        loadInitialData();
      }, 1000);
      return;
    }

    if (!response || (!response.enabled && !response.disabled)) {
      // No tabs to load, don't show loading (like MV2)
      PopupState.isLoading.set(false);
      updateMainUI();
      return;
    }

    const enabled = response.enabled || [];
    const disabled = response.disabled || [];

    PopupState.expectedTabs = enabled.length + disabled.length;
    PopupState.loadedTabs = 0;

    // #!# console.log(`Expected tabs: ${PopupState.expectedTabs} (enabled: ${enabled.length}, disabled: ${disabled.length})`);

    // NEVER show loading if we already have content or no tabs to load
    if (PopupState.expectedTabs === 0) {
      // #!# console.log("No tabs to load, completing immediately");
      PopupState.hasShownInitialContent = true;
      checkLoadingComplete();
      return;
    }

    // Process tabs immediately without any loading state
    // #!# console.log("Processing tabs without loading indicator");
    PopupState.hasShownInitialContent = true;

    // Load enabled tabs with validation
    enabled.forEach(tab => {
      chrome.tabs.get(tab.id, () => {
        if (chrome.runtime.lastError) {
          // #!# console.log("Tab", tab.id, "no longer exists, skipping");
          PopupState.loadedTabs++;
          checkLoadingComplete();
          return;
        }

        // Add a timeout for tab connections to prevent hanging
        let connectionHandled = false;
        const connectionTimeout = setTimeout(() => {
          if (!connectionHandled) {
            console.warn("Connection timeout for tab", tab.id, "- tab may not have controller loaded yet");
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
                // #!# console.log("Tab", tab.id, "- content script not loaded, skipping (not a music site or controller failed)");
              } else if (error.includes("message port closed")) {
                // #!# console.log("Tab", tab.id, "- tab closed or navigated away");
              } else {
                console.warn("Unexpected error getting player state for tab", tab.id, ":", error);
              }

              // DO NOT create default tabs for connection errors - only background script should identify music sites
              PopupState.loadedTabs++;
              checkLoadingComplete();
              return;
            } else if (state) {
              // Use proper fallback for siteName
              const siteName = tab.siteName || state.siteName || tab.streamkeysSiteKey || "Unknown Site";

              const tabData = Object.assign({}, state, {
                tabId: tab.id,
                faviconUrl: tab.favIconUrl,
                siteName: siteName,
                siteKey: tab.streamkeysSiteKey,
                priority: tab.streamkeysPriority || 5,
                streamkeysEnabled: tab.streamkeysEnabled !== undefined ? tab.streamkeysEnabled : true
              });

              PopupState.tabs.set(tab.id, new MusicTab(tabData));

              // FIXED: More aggressive immediate state refreshes with shorter delays
              const refreshTab = () => {
                chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (state) => {
                  if (!chrome.runtime.lastError && state) {
                    const musicTab = PopupState.tabs.get(tab.id);
                    if (musicTab) {
                      // #!# console.log("Immediate refresh for tab", tab.id, "with state:", state);
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
              // #!# console.log("No state returned for tab", tab.id, "- controller may not be ready");
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
          // #!# console.log("Disabled tab", tab.id, "no longer exists, skipping");
          PopupState.loadedTabs++;
          checkLoadingComplete();
          return;
        }

        // Add a timeout for tab connections to prevent hanging
        let connectionHandled = false;
        const connectionTimeout = setTimeout(() => {
          if (!connectionHandled) {
            console.warn("Connection timeout for disabled tab", tab.id, "- tab may not have controller loaded yet");
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
                // #!# console.log("Disabled tab", tab.id, "- content script not loaded (expected for non-music sites)");
              } else if (error.includes("message port closed")) {
                // #!# console.log("Disabled tab", tab.id, "- tab closed or navigated away");
              } else {
                console.warn("Unexpected error getting player state for disabled tab", tab.id, ":", error);
              }
              // Don't create tab element for failed connections
            } else if (state) {
              // Use proper fallback for siteName
              const siteName = tab.siteName || state.siteName || tab.streamkeysSiteKey || "Unknown Site";

              const tabData = Object.assign({}, state, {
                tabId: tab.id,
                faviconUrl: tab.favIconUrl,
                siteName: siteName,
                siteKey: tab.streamkeysSiteKey,
                priority: tab.streamkeysPriority || 5,
                streamkeysEnabled: tab.streamkeysEnabled !== undefined ? tab.streamkeysEnabled : true
              });

              PopupState.disabledTabs.set(tab.id, new MusicTab(tabData));
            } else {
              // #!# console.log("No state returned for disabled tab", tab.id, "- controller may not be ready");
            }

            PopupState.loadedTabs++;
            checkLoadingComplete();
          }
        });
      });
    });
  });
}

function checkLoadingComplete() {
  // #!# console.log(`Loading check: ${PopupState.loadedTabs}/${PopupState.expectedTabs} tabs loaded`);
  // Only stop loading when we've processed all expected tabs (like MV2)
  if (PopupState.loadedTabs >= PopupState.expectedTabs) {
    // #!# console.log("Loading complete, setting isLoading to false");
    PopupState.isLoading.set(false);
    PopupState.hasShownInitialContent = true; // Mark that we've shown content
    updateMainUI();
    setupReactiveUpdates();

    // Refresh current states immediately after initial load to fix button states
    setTimeout(() => {
      // #!# console.log("Post-load state refresh to fix button states");
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
    // #!# console.log("Enabled tabs collection changed, updating UI");
    updateMainUI();
  });

  PopupState.disabledTabs.subscribe(() => {
    // #!# console.log("Disabled tabs collection changed, updating UI");
    updateMainUI();
  });
  // No need to listen to individual tab changes since they're reactive via observables
  // The DOM elements are bound to observables and update automatically
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

  // Listen for real-time updates (MV2-style dynamic tab creation)
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "update_popup_state" && request.stateData) {
      updatePopupState(request.stateData, request.fromTab);
    }
  });

  // Set up periodic cleanup for closed tabs (every 5 seconds)
  setInterval(cleanupClosedTabs, 5000);

  // Refresh states when popup gains focus (user opens popup)
  window.addEventListener("focus", () => {
    console.log("Popup gained focus, refreshing states");
    refreshCurrentStates();
  });

  // IMPROVED: Show empty state first, then load data without loading indicator unless needed
  updateMainUI(); // Show empty state immediately

  setTimeout(() => {
    loadInitialData();
  }, 10); // Minimal delay to ensure DOM is ready

  console.log("*** REACTIVE POPUP INITIALIZED - ZERO FLICKER ***");
});
