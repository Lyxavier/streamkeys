"use strict";

console.log("*** VIRTUAL DOM + SHADOW DOM - ZERO FLICKER ***");

// State management with virtual representation
let VirtualState = {
  tabs: new Map(),
  disabledTabs: new Map(),
  isLoading: true,
  showDisabled: false,
  expectedTabs: 0,
  loadedTabs: 0,
  virtualTree: null, // Virtual representation of UI
  shadowRoot: null   // Shadow DOM container
};

// Virtual DOM node structure
class VNode {
  constructor(tag, props = {}, children = []) {
    this.tag = tag;
    this.props = props;
    this.children = children;
    this.element = null; // Reference to real DOM element
    this.key = props.key || null;
  }
}

// Create virtual DOM tree
function createVirtualTree() {
  const enabledTabs = Array.from(VirtualState.tabs.values())
    .filter(tab => tab.canPlay)
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.siteName !== b.siteName) return a.siteName.localeCompare(b.siteName);
      return a.id - b.id;
    });

  const children = [];

  if (VirtualState.isLoading) {
    children.push(new VNode("div", { class: "no-sites" }, ["Loading..."]));
  } else if (enabledTabs.length === 0 && VirtualState.disabledTabs.size === 0) {
    children.push(new VNode("div", { class: "no-sites" }, ["No music sites open."]));
  } else {
    // Add enabled tabs
    enabledTabs.forEach(tab => {
      children.push(createTabVNode(tab, false));
    });

    // Add disabled section if needed
    if (VirtualState.disabledTabs.size > 0) {
      const toggleText = VirtualState.showDisabled ? "Hide Disabled Sites" : "Show Disabled Sites";
      const toggleIcon = VirtualState.showDisabled ? "arrow_drop_up" : "arrow_drop_down";

      children.push(new VNode("button", {
        class: "mdl-button mdl-js-button mdl-button--raised mdl-button--colored",
        "data-action": "toggle-disabled"
      }, [
        new VNode("span", {}, [toggleText]),
        new VNode("i", { class: "material-icons" }, [toggleIcon])
      ]));

      if (VirtualState.showDisabled) {
        const disabledContainer = new VNode("div", { class: "disabled-site-tab-container" }, []);
        Array.from(VirtualState.disabledTabs.values()).forEach(tab => {
          disabledContainer.children.push(createTabVNode(tab, true));
        });
        children.push(disabledContainer);
      }
    }
  }

  return new VNode("div", { id: "virtual-player" }, children);
}

function createTabVNode(tab, isDisabled) {
  const disabled = !tab.enabled || isDisabled;
  const playIcon = tab.playing ? "pause_arrow" : "play_arrow";

  const controls = [
    new VNode("button", {
      class: "control-btn",
      "data-action": "settings",
      "data-id": tab.id.toString()
    }, [new VNode("i", { class: "material-icons md-dark" }, ["more_vert"])]),
  ];

  if (tab.canPrev) {
    controls.push(new VNode("button", {
      class: "control-btn",
      "data-action": "prev",
      "data-id": tab.id.toString()
    }, [new VNode("i", { class: "material-icons md-dark" }, ["fast_rewind"])]));
  }

  controls.push(new VNode("button", {
    class: "control-btn",
    "data-action": "play",
    "data-id": tab.id.toString()
  }, [new VNode("i", { class: "material-icons md-dark" }, [playIcon])]));

  if (tab.canNext) {
    controls.push(new VNode("button", {
      class: "control-btn",
      "data-action": "next",
      "data-id": tab.id.toString()
    }, [new VNode("i", { class: "material-icons md-dark" }, ["fast_forward"])]));
  }

  controls.push(new VNode("button", {
    class: `control-btn ${!tab.enabled ? "active" : ""}`,
    "data-action": "toggle",
    "data-id": tab.id.toString()
  }, [new VNode("i", { class: "material-icons md-dark" }, ["not_interested"])]));

  const children = [
    new VNode("div", { class: "player-row player-container" }, [
      new VNode("div", { class: "site-data" }, [
        new VNode("span", { class: "site-priority-label" }, [tab.priority.toString()]),
        new VNode("a", {
          href: "#",
          class: "site-link",
          "data-action": "open-tab",
          "data-id": tab.id.toString()
        }, [
          new VNode("img", {
            class: "site-favicon",
            src: tab.favicon,
            onerror: "this.style.display=\"none\""
          }),
          new VNode("span", { class: "site-title" }, [tab.siteName])
        ])
      ]),
      ...(tab.songText ? [new VNode("div", { class: "marquee song-data" }, [
        new VNode("p", { class: "song-text" }, [tab.songText])
      ])] : [])
    ]),
    new VNode("div", { class: "player-controls-container player-container" }, controls)
  ];

  if (tab.showSettings) {
    children.push(new VNode("div", { class: "site-settings", style: "display: block" }, [
      new VNode("div", { class: "settings-item left" }, [
        new VNode("label", {}, ["Priority"]),
        new VNode("button", {
          class: "control-btn",
          "data-action": "priority-",
          "data-id": tab.id.toString(),
          disabled: tab.priority <= 1
        }, [new VNode("i", { class: "material-icons" }, ["remove_circle"])]),
        new VNode("span", {}, [tab.priority.toString()]),
        new VNode("button", {
          class: "control-btn",
          "data-action": "priority+",
          "data-id": tab.id.toString(),
          disabled: tab.priority >= 9
        }, [new VNode("i", { class: "material-icons" }, ["add_circle"])])
      ]),
      new VNode("div", { class: "settings-item right" }, [
        new VNode("button", {
          class: "mdl-button mdl-button--raised",
          "data-action": "options"
        }, ["Advanced Settings"])
      ])
    ]));
  }

  return new VNode("div", {
    class: `site-tab-container ${disabled ? "disabled" : ""}`,
    key: `tab-${tab.id}`,
    "data-tab-id": tab.id.toString()
  }, children);
}

// Render virtual DOM to shadow DOM (isolated from main DOM)
function renderToShadowDOM(vnode) {
  if (typeof vnode === "string") {
    return document.createTextNode(vnode);
  }

  const element = document.createElement(vnode.tag);

  // Set properties
  Object.keys(vnode.props).forEach(key => {
    if (key === "style") {
      element.style.cssText = vnode.props[key];
    } else if (key === "class") {
      element.className = vnode.props[key];
    } else if (key.startsWith("data-")) {
      element.setAttribute(key, vnode.props[key]);
    } else if (key === "disabled") {
      element.disabled = vnode.props[key];
    } else {
      element.setAttribute(key, vnode.props[key]);
    }
  });

  // Render children
  vnode.children.forEach(child => {
    const childElement = renderToShadowDOM(child);
    element.appendChild(childElement);
  });

  vnode.element = element;
  return element;
}

// Initialize Shadow DOM container
function initializeShadowDOM() {
  const player = document.getElementById("player");

  // Clear existing content
  player.innerHTML = "";

  // Create shadow root for complete DOM isolation
  VirtualState.shadowRoot = player.attachShadow({ mode: "open" });

  // Copy styles into shadow DOM
  const style = document.createElement("style");
  style.textContent = `
    @import url("https://fonts.googleapis.com/css?family=Roboto:300,400,500,700");
    @import url("https://fonts.googleapis.com/icon?family=Material+Icons");
    @import url("https://code.getmdl.io/1.3.0/material.indigo-pink.min.css");
    @import url("/css/popup.css");

    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  VirtualState.shadowRoot.appendChild(style);

  console.log("*** SHADOW DOM INITIALIZED ***");
}

// Update UI by replacing shadow DOM content entirely
function updateUI() {
  console.log("*** VIRTUAL DOM UPDATE - SHADOW ISOLATED ***");

  if (!VirtualState.shadowRoot) {
    console.warn("Shadow DOM not initialized");
    return;
  }

  // Create new virtual tree
  const newVirtualTree = createVirtualTree();

  // Render to shadow DOM (completely isolated)
  const newElement = renderToShadowDOM(newVirtualTree);

  // Replace content in shadow DOM only
  const existingContent = VirtualState.shadowRoot.querySelector("#virtual-player");
  if (existingContent) {
    VirtualState.shadowRoot.removeChild(existingContent);
  }

  VirtualState.shadowRoot.appendChild(newElement);

  // Bind events to shadow DOM elements
  bindShadowEvents();

  VirtualState.virtualTree = newVirtualTree;
}

// Event handling in shadow DOM
function bindShadowEvents() {
  const shadowPlayer = VirtualState.shadowRoot.querySelector("#virtual-player");
  if (!shadowPlayer) return;

  // Event delegation on shadow DOM
  shadowPlayer.addEventListener("click", handleShadowClick);
}

function handleShadowClick(e) {
  e.preventDefault();

  const action = e.target.closest("[data-action]")?.dataset.action;
  const tabId = parseInt(e.target.closest("[data-id]")?.dataset.id);

  if (!action) return;

  const tab = VirtualState.tabs.get(tabId) || VirtualState.disabledTabs.get(tabId);

  switch (action) {
  case "settings":
    if (tab) {
      tab.showSettings = !tab.showSettings;
      updateUI();
    }
    break;

  case "play":
    if (tab && tab.enabled) {
      sendCommand(tabId, "playPause");
    }
    break;

  case "next":
    if (tab && tab.enabled) {
      sendCommand(tabId, "playNext");
    }
    break;

  case "prev":
    if (tab && tab.enabled) {
      sendCommand(tabId, "playPrev");
    }
    break;

  case "toggle":
    if (tab) {
      tab.enabled = !tab.enabled;
      chrome.runtime.sendMessage({
        action: "toggle_enabled",
        tab_target: tabId,
        enabled: tab.enabled
      });
      updateUI();
    }
    break;

  case "priority+":
    if (tab && tab.priority < 9) {
      tab.priority++;
      updatePriority(tab);
    }
    break;

  case "priority-":
    if (tab && tab.priority > 1) {
      tab.priority--;
      updatePriority(tab);
    }
    break;

  case "toggle-disabled":
    VirtualState.showDisabled = !VirtualState.showDisabled;
    updateUI();
    break;

  case "open-tab":
    chrome.tabs.update(tabId, { active: true });
    window.close();
    break;

  case "options":
    window.open(chrome.runtime.getURL("html/options.html"));
    break;
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

function updatePriority(tab) {
  chrome.runtime.sendMessage({
    action: "update_site_settings",
    siteKey: tab.siteKey,
    siteState: { priority: tab.priority }
  });
  updateUI();
}

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

// Data loading
function loadInitialData() {
  chrome.runtime.sendMessage({ action: "get_music_tabs" }, (response) => {
    if (!response || (!response.enabled && !response.disabled)) {
      VirtualState.isLoading = false;
      updateUI();
      return;
    }

    const enabled = response.enabled || [];
    const disabled = response.disabled || [];

    VirtualState.expectedTabs = enabled.length + disabled.length;
    VirtualState.loadedTabs = 0;

    // Load enabled tabs
    enabled.forEach(tab => {
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

          VirtualState.tabs.set(tab.id, createTab(tabData));
        }

        VirtualState.loadedTabs++;
        if (VirtualState.loadedTabs >= VirtualState.expectedTabs) {
          VirtualState.isLoading = false;
          updateUI();
        }
      });
    });

    // Load disabled tabs
    disabled.forEach(tab => {
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

          VirtualState.disabledTabs.set(tab.id, createTab(tabData));
        }

        VirtualState.loadedTabs++;
        if (VirtualState.loadedTabs >= VirtualState.expectedTabs) {
          VirtualState.isLoading = false;
          updateUI();
        }
      });
    });
  });
}

// Initialize
document.addEventListener("DOMContentLoaded", function() {
  console.log("*** INITIALIZING VIRTUAL + SHADOW DOM POPUP ***");

  initializeShadowDOM();

  // Bind footer (outside shadow DOM)
  document.getElementById("options-link").onclick = () => {
    window.open(chrome.runtime.getURL("html/options.html"));
  };
  document.getElementById("help-link").onclick = () => {
    window.open("http://www.streamkeys.com/guide.html");
  };
  document.getElementById("donate-link").onclick = () => {
    window.open("http://www.streamkeys.com/donate.html");
  };

  // Listen for real-time updates
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "update_popup_state" && request.stateData) {
      const tab = VirtualState.tabs.get(request.fromTab.id) || VirtualState.disabledTabs.get(request.fromTab.id);
      if (tab) {
        Object.assign(tab, request.stateData);
        updateUI();
      }
    }
  });

  loadInitialData();

  console.log("*** VIRTUAL + SHADOW DOM POPUP INITIALIZED ***");
});
