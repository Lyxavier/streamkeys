"use strict";

/* eslint-disable no-unused-vars */

// Service Worker for Streamkeys Extension (Manifest V3)


// Import required modules using importScripts (MV3 compatible)
try {
  importScripts("sites-mv3.js");


  // Debug: Check specific sites
  if (typeof STREAMKEYS_SITES === "object" && STREAMKEYS_SITES) {
    // Sites loaded successfully
  }
} catch (error) {
  // Error loading sites - handled gracefully
}

/**
 * Global variables for service worker context
 */
var skSites = null;

// Service worker lifecycle logging


/**
 * Map from tab.id to it's status and time when it was updated
 * e.g. tabStates = {"787" : {"timestamp": <epoch>, "state": <state>}, ...}
 * Look ./modules/BaseController.js getStateData method for what is state.
 * ENHANCED: Hybrid storage + active recovery to handle MV3 service worker restarts
 */
var tabStates = {};
var stateRecoveryInProgress = false;
var lastRecoveryTime = 0;

/**
 * Array of disabled tab IDs (MV2/MV3 hybrid persistence)
 * FIXED: Now uses persistent storage like tab states for MV2/MV3 blend
 */
var disabledTabs = [];

/**
 * Command handler for keyboard shortcuts (MV3 - set up immediately)
 * This must be registered at the top level to ensure it survives service worker restarts
 */
function setupCommandListener() {


  // Remove any existing listeners first
  if (chrome.commands.onCommand.hasListeners()) {
    chrome.commands.onCommand.removeListener(handleCommand);
  }

  chrome.commands.onCommand.addListener(handleCommand);

  // Verify the listener is working by checking available commands
  chrome.commands.getAll(() => {

    //   name: cmd.name,
    //   shortcut: cmd.shortcut,
    //   description: cmd.description
    // }))); // #!# DEBUG
  });
}

function handleCommand(command) {


  // If not initialized yet, try to initialize and retry
  if (!skSites) {

    initialize();

    // Retry after a short delay to allow initialization
    setTimeout(() => {
      sendAction(command);
    }, 100);
  } else {
    sendAction(command);
  }
}

// Set up command listener immediately
setupCommandListener();

/**
 * Enhanced tab state recovery for MV3 service worker restarts
 * Combines storage persistence with active polling of content scripts
 */
async function recoverTabStates() {
  if (stateRecoveryInProgress) {
    // console.log("State recovery in progress, skipping..."); // #!# DEBUG
    return;
  }

  const now = Date.now();
  if (now - lastRecoveryTime < 5000) {
    // console.log("State recovery too recent, skipping..."); // #!# DEBUG
    return;
  }

  stateRecoveryInProgress = true;
  lastRecoveryTime = now;
  // console.log("Starting enhanced tab state recovery..."); // #!# DEBUG

  try {
    // First: Load any persisted states from storage
    await loadTabStates();
    // console.log("Loaded", Object.keys(tabStates).length, "persisted tab states"); // #!# DEBUG

    // Second: Query all current tabs and request fresh states
    if (!skSites) {
      // console.log("Sites interface not ready, skipping recovery"); // #!# DEBUG
      stateRecoveryInProgress = false;
      return;
    }

    const tabs = await chrome.tabs.query({});
    const sites = (typeof STREAMKEYS_SITES !== "undefined") ? STREAMKEYS_SITES :
      (typeof self.STREAMKEYS_SITES !== "undefined") ? self.STREAMKEYS_SITES : null;

    if (!sites) {
      // console.log("Sites data unavailable for recovery"); // #!# DEBUG
      stateRecoveryInProgress = false;
      return;
    }

    const musicTabs = tabs.filter(tab => {
      if (!tab.url) return false;
      return Object.values(sites).some(site => {
        if (!site.url) return false;
        const siteUrl = site.url.replace(/^https?:\/\//, "");
        const tabUrlWithoutProtocol = tab.url.replace(/^https?:\/\//, "");

        // Use more precise matching - check if URL starts with site domain
        return tabUrlWithoutProtocol.startsWith(siteUrl) ||
               tabUrlWithoutProtocol.startsWith(siteUrl.replace("www.", "")) ||
               tabUrlWithoutProtocol.startsWith("www." + siteUrl);
      });
    });

    // console.log("Found", musicTabs.length, "music tabs to recover"); // #!# DEBUG

    // Third: Request current state from each music tab with improved error handling
    const recoveryPromises = musicTabs.map(tab =>
      new Promise((resolve) => {
        // FIXED: First check if the tab still exists and is accessible
        chrome.tabs.get(tab.id, (tabInfo) => {
          if (chrome.runtime.lastError || !tabInfo) {
            // console.log("Tab", tab.id, "no longer exists"); // DEBUG
            resolve(null);
            return;
          }

          // FIXED: Skip tabs that are not fully loaded
          if (tabInfo.status === "loading") {
            // console.log("Tab", tab.id, "still loading"); // DEBUG
            resolve(null);
            return;
          }

          const timeoutId = setTimeout(() => {
            // console.log("Tab", tab.id, "state request timeout"); // #!# DEBUG
            resolve(null);
          }, 3000); // Increased timeout to 3 seconds

          chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (response) => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              // console.log("No response from tab", tab.id, ":", chrome.runtime.lastError.message); // #!# DEBUG
              resolve(null);
            } else if (response) {
              // console.log("Recovered fresh state for tab", tab.id); // #!# DEBUG
              tabStates[tab.id] = {
                timestamp: Date.now(),
                state: response
              };
              resolve(tab.id);
            } else {
              resolve(null);
            }
          });
        });
      })
    );

    const recoveredTabs = await Promise.all(recoveryPromises);
    const freshCount = recoveredTabs.filter(Boolean).length;

    // console.log("Recovery complete - Fresh:", freshCount, "Total:", Object.keys(tabStates).length); // #!# DEBUG

    // Save the recovered states
    if (freshCount > 0) {
      await saveTabStates();
    }

  } catch (error) {
    // console.error("Streamkeys: Error during state recovery:", error);
  } finally {
    stateRecoveryInProgress = false;
  }
}

/**
 * Load tab states from storage on service worker start (MV2-style persistence)
 */
function loadTabStates() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["tabStates"], (result) => {
      if (chrome.runtime.lastError) {
        // console.warn("Streamkeys: Error loading tab states from storage:", chrome.runtime.lastError.message);
        tabStates = {};
      } else {
        tabStates = result.tabStates || {};
        // console.log("Loaded", Object.keys(tabStates).length, "tab states from storage"); // DEBUG
      }
      resolve();
    });
  });
}

/**
 * Save tab states to storage to persist across service worker restarts (MV2-style persistence)
 */
function saveTabStates() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ tabStates: tabStates }, () => {
      if (chrome.runtime.lastError) {
        // console.warn("Streamkeys: Error saving tab states to storage:", chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError);
      } else {
        // console.log("Saved", Object.keys(tabStates).length, "tab states to storage"); // DEBUG
        resolve();
      }
    });
  });
}

/**
 * Load disabled tabs from storage on service worker start (MV2/MV3 hybrid persistence)
 */
function loadDisabledTabs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["disabledTabs"], (result) => {
      if (chrome.runtime.lastError) {
        // console.warn("Streamkeys: Error loading disabled tabs from storage:", chrome.runtime.lastError.message);
        disabledTabs = [];
      } else {
        disabledTabs = result.disabledTabs || [];
        // console.log("Loaded", disabledTabs.length, "disabled tabs from storage"); // DEBUG
      }
      resolve();
    });
  });
}

/**
 * Save disabled tabs to storage to persist across service worker restarts (MV2/MV3 hybrid persistence)
 */
function saveDisabledTabs() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ disabledTabs: disabledTabs }, () => {
      if (chrome.runtime.lastError) {
        // console.warn("Streamkeys: Error saving disabled tabs to storage:", chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError);
      } else {
        // console.log("Saved", disabledTabs.length, "disabled tabs to storage"); // DEBUG
        resolve();
      }
    });
  });
}

// console.log("Service worker initializing..."); // #!# DEBUG
initialize();

// Initialize when service worker starts/restarts
chrome.runtime.onStartup.addListener(() => {
  // console.log("Service worker onStartup event"); // #!# DEBUG
  setupCommandListener(); // Re-setup command listener
  initialize();
});

chrome.runtime.onInstalled.addListener(() => {
  // console.log("Service worker onInstalled event"); // #!# DEBUG
  setupCommandListener(); // Re-setup command listener
  initialize();
});

function initialize() {
  // console.log("Service worker initializing, disabled tabs:", disabledTabs.length); // #!# DEBUG

  // First: Load basic tab states and disabled tabs from storage
  Promise.all([loadTabStates(), loadDisabledTabs()]).then(() => {
    // console.log("Basic storage loaded:", Object.keys(tabStates).length, "tabs,", disabledTabs.length, "disabled"); // #!# DEBUG

    // console.log("Sites check - global:", typeof STREAMKEYS_SITES, "self:", typeof self.STREAMKEYS_SITES); // #!# DEBUG

    try {
    // Sites list is available from sites-mv3.js as STREAMKEYS_SITES
    // Check both global scope and self scope for service worker compatibility
      let sites = (typeof STREAMKEYS_SITES !== "undefined") ? STREAMKEYS_SITES :
        (typeof self.STREAMKEYS_SITES !== "undefined") ? self.STREAMKEYS_SITES : null;

      // console.log("Final sites object:", sites ? Object.keys(sites).length + " sites found" : "null/undefined");
      if (sites) {
        // console.log("Sites loaded:", Object.keys(sites).length, "YouTube:", !!sites.youtube); // #!# DEBUG
        if (sites.youtube) {
          // console.log("YouTube config:", sites.youtube); // #!# DEBUG
        }
      } else {
        // console.error("CRITICAL - Sites null! Fallback:", typeof STREAMKEYS_SITES, typeof self.STREAMKEYS_SITES); // #!# DEBUG

        // Try direct access as fallback
        if (typeof STREAMKEYS_SITES !== "undefined") {
          // console.log("Using STREAMKEYS_SITES fallback"); // #!# DEBUG
          sites = STREAMKEYS_SITES; // Set sites variable for the rest of the function
        } else {
          // console.error("EMERGENCY FALLBACK - minimal sites object"); // #!# DEBUG
          sites = {
            youtube: { name: "YouTube", url: "https://youtube.com", controller: "YoutubeController-mv3.js" },
            spotify: { name: "Spotify", url: "https://open.spotify.com", controller: "SpotifyController.js" }
          };
        }
      }

      if (sites) {
      // Create a simple sites interface first
        skSites = {
          getActiveMusicTabs: function() {
            return new Promise((resolve, reject) => {
              chrome.tabs.query({}, (allTabs) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                  return;
                }

                // console.log("getActiveMusicTabs checking", allTabs.length, "total tabs"); // DEBUG

                const musicTabs = allTabs.filter(tab => {
                  if (!tab.url) {
                    // console.log("Skipping tab", tab.id, "- no URL"); // #!# DEBUG
                    return false;
                  }

                  // Check if it's a music site first


                  const isMusicSite = Object.values(sites).some(site => {
                    if (!site.url) return false;

                    // More robust URL matching
                    const siteUrl = site.url.replace(/^https?:\/\//, "").replace(/^www\./, "");
                    const tabUrl = tab.url.replace(/^https?:\/\//, "").replace(/^www\./, "");

                    // Check multiple matching patterns
                    const directMatch = tabUrl.includes(siteUrl);
                    const reverseMatch = siteUrl.includes(tabUrl.split("/")[0]); // Domain-only match
                    const domainMatch = tabUrl.split("/")[0] === siteUrl.split("/")[0]; // Exact domain match

                    const matches = directMatch || reverseMatch || domainMatch;

                    if (matches) {
                      // console.log("Tab", tab.id, "matches", site.name, "site", { siteUrl, tabUrl }); // DEBUG
                    }
                    return matches;
                  });

                  if (!isMusicSite) {
                    // Special debug for common music sites
                    if (tab.url.includes("youtube.com") || tab.url.includes("spotify.com") || tab.url.includes("soundcloud.com")) {
                      // console.log("Tab", tab.id, "known site not detected:", tab.url, Object.keys(sites).length, "sites available"); // DEBUG
                    }
                    return false;
                  }

                  // FIXED: Only include tabs that have working controllers (MV2-style behavior)
                  // Check if we have a cached state for this tab (indicates working controller)
                  const hasWorkingController = tabStates[tab.id] && tabStates[tab.id].state;
                  if (!hasWorkingController) {
                    // console.log("Streamkeys: Tab", tab.id, "is music site but no working controller, excluding"); // DEBUG
                    return false;
                  }

                  // Filter out disabled tabs (matching MV2 behavior)
                  const isDisabled = disabledTabs.includes(tab.id);
                  if (isDisabled) {
                    // console.log("Streamkeys: Filtering out disabled tab:", tab.id, tab.url); // #!# DEBUG
                    return false;
                  }

                  // console.log("Tab", tab.id, "is active music tab with working controller:", tab.url); // #!# DEBUG
                  return true;
                });

                // console.log("Found", musicTabs.length, "enabled music tabs from", allTabs.length, "total tabs"); // DEBUG
                // console.log("Current disabled tabs:", [...disabledTabs]); // DEBUG
                resolve(musicTabs);
              });
            });
          },

          getDisabledMusicTabs: function() {
            return new Promise((resolve, reject) => {
              chrome.tabs.query({}, (allTabs) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                  return;
                }

                // Return only tabs that are disabled and are music sites
                const disabledMusicTabs = allTabs.filter(tab => {
                  if (!tab.url) return false;

                  // Must be in disabled tabs list
                  if (!disabledTabs.includes(tab.id)) return false;

                  // Must be a music site
                  return Object.values(sites).some(site => {
                    if (!site.url) return false;
                    const siteUrl = site.url.replace(/^https?:\/\//, "");
                    return tab.url.includes(siteUrl) ||
                         tab.url.includes(siteUrl.replace("www.", ""));
                  });
                });

                resolve(disabledMusicTabs);
              });
            });
          },

          getController: function(url) {
            if (!url) return null;

            // Find matching site and return controller filename
            for (const siteKey in sites) {
              const site = sites[siteKey];
              if (!site.url) continue;

              const siteUrl = site.url.replace(/^https?:\/\//, "");
              const urlWithoutProtocol = url.replace(/^https?:\/\//, "");

              // Use more precise matching - check if URL starts with site domain
              if (urlWithoutProtocol.startsWith(siteUrl) ||
                  urlWithoutProtocol.startsWith(siteUrl.replace("www.", "")) ||
                  urlWithoutProtocol.startsWith("www." + siteUrl)) {
                const controllerFile = site.controller || (siteKey + "Controller.js");
                return `js/controllers/${controllerFile}`;
              }
            }
            return null;
          }
        };
        // console.log("Sites interface created successfully with", Object.keys(sites).length, "sites");

        // console.log("Sites interface ready, starting enhanced recovery..."); // #!# DEBUG
        recoverTabStates().then(() => {
          // console.log("Enhanced recovery completed"); // #!# DEBUG
        }).catch(error => {
          // console.error("Enhanced recovery failed:", error);
        });

        // Set up periodic command listener health check and state recovery
        // FIXED: Reduced frequency and added startup grace period
        setTimeout(() => {
          setInterval(() => {
            // console.log("Health check - listeners:", chrome.commands.onCommand.hasListeners()); // #!# DEBUG

            // Check command listener health
            if (!chrome.commands.onCommand.hasListeners()) {
              // console.warn("Command listener missing, re-registering"); // #!# DEBUG
              setupCommandListener();
            }

            // Periodic state recovery to handle stale states
            // FIXED: Increased threshold to be less aggressive and give content scripts time to load
            const staleThreshold = 120000; // 2 minutes instead of 30 seconds
            const now = Date.now();
            const staleStates = Object.entries(tabStates).filter(([, data]) =>
              now - data.timestamp > staleThreshold
            ).length;

            if (staleStates > 0) {
              // console.log("Found", staleStates, "stale states, triggering recovery"); // #!# DEBUG
              recoverTabStates();
            }
          }, 60000); // Check every minute instead of every 30 seconds
        }, 30000); // Wait 30 seconds after startup before starting health checks
      } else {
        // console.error("Streamkeys: STREAMKEYS_SITES not available - sites list is null/undefined");
        // Retry initialization after a short delay
        setTimeout(() => {
          // console.log("Streamkeys: Retrying initialization...");
          initialize();
        }, 1000);
      }
    } catch (error) {
      // console.error("Streamkeys: Error initializing service worker:", error);
    }
  }).catch(error => {
    // console.error("Streamkeys: Error loading storage during initialization:", error);
    // console.log("Continuing init without storage, resetting to defaults"); // #!# DEBUG

    try {
      // Reset to defaults if storage failed
      tabStates = {};
      disabledTabs = [];
      // Sites list is available from sites-mv3.js as STREAMKEYS_SITES
      const sites = (typeof STREAMKEYS_SITES !== "undefined") ? STREAMKEYS_SITES :
        (typeof self.STREAMKEYS_SITES !== "undefined") ? self.STREAMKEYS_SITES : null;

      if (sites) {
        // console.log("Creating skSites interface with", Object.keys(sites).length, "sites"); // #!# DEBUG
        // Create a simple sites interface first
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

                  // Check if it's a music site first
                  const isMusicSite = Object.values(sites).some(site => {
                    if (!site.url) return false;
                    const siteUrl = site.url.replace(/^https?:\/\//, "");
                    return tab.url.includes(siteUrl) ||
                         tab.url.includes(siteUrl.replace("www.", ""));
                  });

                  if (!isMusicSite) return false;

                  // FIXED: Only include tabs that have working controllers (MV2-style behavior)
                  // Check if we have a cached state for this tab (indicates working controller)
                  const hasWorkingController = tabStates[tab.id] && tabStates[tab.id].state;
                  if (!hasWorkingController) {
                    // console.log("Streamkeys: Tab", tab.id, "is music site but no working controller, excluding"); // DEBUG
                    return false;
                  }

                  // Filter out disabled tabs (matching MV2 behavior)
                  const isDisabled = disabledTabs.includes(tab.id);
                  if (isDisabled) {
                    // console.log("Streamkeys: Filtering out disabled tab:", tab.id, tab.url); // #!# DEBUG
                    return false;
                  }

                  return true;
                });

                // console.log("Streamkeys: Found", musicTabs.length, "enabled music tabs from", allTabs.length, "total tabs"); // #!# DEBUG
                resolve(musicTabs);
              });
            });
          },

          getDisabledMusicTabs: function() {
            return new Promise((resolve, reject) => {
              chrome.tabs.query({}, (allTabs) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                  return;
                }

                // Return only tabs that are disabled and are music sites
                const disabledMusicTabs = allTabs.filter(tab => {
                  if (!tab.url) return false;

                  // Must be in disabled tabs list
                  if (!disabledTabs.includes(tab.id)) return false;

                  // Must be a music site
                  return Object.values(sites).some(site => {
                    if (!site.url) return false;
                    const siteUrl = site.url.replace(/^https?:\/\//, "");
                    return tab.url.includes(siteUrl) ||
                         tab.url.includes(siteUrl.replace("www.", ""));
                  });
                });

                resolve(disabledMusicTabs);
              });
            });
          },

          getController: function(url) {
            if (!url) return null;

            // Find matching site and return controller filename
            for (const siteKey in sites) {
              const site = sites[siteKey];
              if (!site.url) continue;

              const siteUrl = site.url.replace(/^https?:\/\//, "");
              const urlWithoutProtocol = url.replace(/^https?:\/\//, "");

              // Use more precise matching - check if URL starts with site domain
              if (urlWithoutProtocol.startsWith(siteUrl) ||
                  urlWithoutProtocol.startsWith(siteUrl.replace("www.", "")) ||
                  urlWithoutProtocol.startsWith("www." + siteUrl)) {
                const controllerFile = site.controller || (siteKey + "Controller.js");
                return `js/controllers/${controllerFile}`;
              }
            }
            return null;
          }
        };

        // console.log("Streamkeys: Service worker fully initialized with sites interface");
        // console.log("Streamkeys: Command listeners set up:", !!chrome.commands.onCommand.hasListeners());

        // Start health checks after initialization
        setTimeout(() => {
          // console.log("Streamkeys: Starting periodic health checks...");
          setInterval(() => {
            const hasListeners = chrome.commands.onCommand.hasListeners();
            if (!hasListeners) {
              // console.warn("Streamkeys: Command listeners lost, re-establishing...");
              setupCommandListener();
            }
          }, 30000); // Check every 30 seconds
        }, 30000); // Wait 30 seconds after startup before starting health checks
      } else {
        // console.error("Streamkeys: STREAMKEYS_SITES not available even after storage error - sites list is null/undefined");
        // Retry initialization after a short delay
        setTimeout(() => {
          // console.log("Streamkeys: Retrying initialization after storage error...");
          initialize();
        }, 1000);
      }
    } catch (error) {
      // console.error("Streamkeys: Error in fallback initialization:", error);
    }
  }); // Close Promise.all([loadTabStates(), loadDisabledTabs()]).then().catch()

  // ENHANCEMENT: Listen for new tab creation and updates to notify popup
  chrome.tabs.onCreated.addListener((tab) => {
    console.log("Background: New tab created:", tab.id, tab.url);
    if (tab.url && isValidMusicSiteUrl(tab.url)) {
      console.log("Background: New music site tab detected, will notify popup when ready");
      // Give tab a moment to load before checking
      setTimeout(() => {
        notifyPopupOfNewTab(tab);
      }, 2000);
    }
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url && isValidMusicSiteUrl(tab.url)) {
      console.log("Background: Music site tab loaded completely:", tabId, tab.url);
      // Wait a bit longer for controller injection
      setTimeout(() => {
        notifyPopupOfNewTab(tab);
      }, 1500);
    }
  });
}

// Helper function to check if URL is a music site (using proper Sitelist logic)
function isValidMusicSiteUrl(url) {
  if (!url || !skSites) return false;

  // Use the proper Sitelist controller detection logic
  try {
    const controller = skSites.getController(url);
    return !!controller; // Returns true if a controller exists for this URL
  } catch (error) {
    console.log("Background: Error checking music site:", error);
    return false;
  }
}

// Notify popup of new music tab
function notifyPopupOfNewTab(tab) {
  console.log("Background: Checking if tab", tab.id, "has working controller...");

  // First verify the tab actually has a working controller
  chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("Background: Tab", tab.id, "not ready yet (no controller)");
      return;
    }

    console.log("Background: Tab", tab.id, "confirmed working, notifying popup");

    // Send message to popup if it's open
    chrome.runtime.sendMessage({
      action: "new_music_tab_detected",
      tabData: {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      }
    }).catch(() => {
      // Popup not open, that's fine
      console.log("Background: Popup not open, new tab notification skipped");
    });
  });
}

/**
 * Send a player action to every active player tab if it's state command
 * or "stop"-like command. Otherwise command target depends on
 * "single player mode" option.
 * @param {String} command - name of the command to pass to the players
 */
var sendAction = function(command) {
  // console.log("sendAction:", command, "sites:", !!skSites, "tabs:", Object.keys(tabStates).length); // #!# DEBUG
  if (!skSites) {
    // console.log("Background not initialized, skipping:", command); // #!# DEBUG
    return;
  }

  // If we have very few or no tab states, try a quick recovery
  const currentTabCount = Object.keys(tabStates).length;
  if (currentTabCount === 0 && !stateRecoveryInProgress) {
    // console.log("No tab states, quick recovery then retry:", command); // #!# DEBUG
    recoverTabStates().then(() => {
      sendActionWithTabs(command);
    });
    return;
  }

  sendActionWithTabs(command);
};

function sendActionWithTabs(command) {
  skSites.getActiveMusicTabs().then(function(tabs) {
    // console.log("Sending", command, "to", tabs.length, "active tabs"); // #!# DEBUG

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
    // console.error("Streamkeys: Error getting active music tabs:", error);
  });
}

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
        // console.log("Streamkeys: Could not send message to tab", tab.id, ":", chrome.runtime.lastError.message);
      }
    });
  });
};

/**
 * Message handler for popup and content script communication
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Background: Received message:", request.action, "from", sender.tab ? "tab " + sender.tab.id : "popup/extension");

  try {
    if (request.action === "get_music_tabs") {
      // console.log("Streamkeys: get_music_tabs request received"); // #!# DEBUG
      // console.log("Streamkeys: skSites initialized:", !!skSites); // #!# DEBUG
      // console.log("Streamkeys: skSites type:", typeof skSites); // #!# DEBUG
      if (!skSites) {
        // console.warn("Streamkeys: Sites not initialized, attempting initialization...");
        // Try to initialize before responding
        initialize();
        setTimeout(() => {
          if (skSites) {
            // console.log("Streamkeys: Initialization successful, retrying get_music_tabs");
            skSites.getActiveMusicTabs().then(enabled => {
              skSites.getDisabledMusicTabs().then(disabled => {
                sendResponse({ enabled: enabled || [], disabled: disabled || [] });
              }).catch(error => {
                // console.error("Streamkeys: Error getting disabled tabs:", error);
                sendResponse({ enabled: enabled || [], disabled: [] });
              });
            }).catch(error => {
              // console.error("Streamkeys: Error getting enabled tabs:", error);
              sendResponse({ enabled: [], disabled: [] });
            });
          } else {
            // console.error("Streamkeys: Initialization failed, returning empty result");
            sendResponse({ enabled: [], disabled: [] });
          }
        }, 100);
        return true; // Async response
      }

      skSites.getActiveMusicTabs().then(enabled => {
        // console.log("Background found", enabled.length, "enabled music tabs");
        skSites.getDisabledMusicTabs().then(disabled => {
          // console.log("Background found", disabled.length, "disabled music tabs:", disabled.map(t => ({id: t.id, url: t.url})));
          sendResponse({ enabled: enabled || [], disabled: disabled || [] });
        }).catch(error => {
          // console.error("Streamkeys: Error getting disabled tabs:", error);
          sendResponse({ enabled: enabled || [], disabled: [] });
        });
      }).catch(error => {
        // console.error("Streamkeys: Error getting enabled tabs:", error);
        sendResponse({ enabled: [], disabled: [] });
      });

      return true; // Async response
    }

    if (request.action === "get_cached_states") {
      // Return cached tab states for MV2-style popup initialization
      sendResponse({ tabStates: tabStates });
      return;
    }

    if (request.action === "trigger_state_recovery") {
      // console.log("Manual state recovery triggered"); // #!# DEBUG
      recoverTabStates().then(() => {
        sendResponse({
          success: true,
          recoveredStates: Object.keys(tabStates).length,
          message: "State recovery completed"
        });
      }).catch(error => {
        sendResponse({
          success: false,
          error: error.message
        });
      });
      return true; // Async response
    }

    if (request.action === "check_music_site") {
      if (!skSites || !sender.tab || !sender.tab.url) {
        sendResponse("no_inject");
        return;
      }

      // Check if this URL is a supported music site
      const controller = skSites.getController(sender.tab.url);
      if (controller) {
        sendResponse("inject");
      } else {
        sendResponse("no_inject");
      }
      return;
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

    // FIXED: Add ping handler for content script readiness check
    if (request.action === "ping") {
      sendResponse({ pong: true, ready: !!skSites });
      return;
    }

    if (request.action === "inject_controller") {
      // console.log("Streamkeys: Inject:", request.file, "into tab:", sender.tab.id);

      // MV3 Fix: Ensure we have the right permissions and the tab is accessible
      chrome.tabs.get(sender.tab.id, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          // console.error("Streamkeys: Tab not accessible:", chrome.runtime.lastError?.message || "Tab not found");
          sendResponse({success: false, error: "Tab not accessible"});
          return;
        }

        // Check if tab URL is injectable (not chrome:// or extension pages)
        if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("moz-extension://")) {
          // console.warn("Streamkeys: Cannot inject into browser internal pages");
          sendResponse({success: false, error: "Cannot inject into browser internal pages"});
          return;
        }

        chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          files: [request.file]
        }, function() {
          if (chrome.runtime.lastError) {
            // console.error("Streamkeys: Error executing script:", chrome.runtime.lastError.message);
            sendResponse({success: false, error: chrome.runtime.lastError.message});
          } else {
            // console.log("Streamkeys: Script injected successfully");
            sendResponse({success: true});
          }
        });
      });
      return true; // Async response
    }

    if (request.action === "test_command") {
      // console.log("Streamkeys: Manual command test:", request.command); // #!# DEBUG
      handleCommand(request.command || "playPause");
      sendResponse({ success: true, message: "Command test executed" });
      return;
    }

    if (request.action === "get_command_status") {
      const hasListeners = chrome.commands.onCommand.hasListeners();
      const skSitesReady = !!skSites;
      // console.log("Streamkeys: Command status check - Listeners:", hasListeners, "Sites:", skSitesReady); // #!# DEBUG
      sendResponse({
        hasListeners: hasListeners,
        skSitesReady: skSitesReady,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (request.action === "command" && request.command) {
      // console.log("Streamkeys: Processing command:", request.command, "for tab:", request.tab_target);
      if (request.tab_target) {
        // Send command to specific tab
        chrome.tabs.sendMessage(request.tab_target, { action: request.command }, function(response) {
          if (chrome.runtime.lastError) {
            // console.log("Streamkeys: Error sending command to tab:", chrome.runtime.lastError.message);

            // If command failed due to connection issues, try recovery
            if (chrome.runtime.lastError.message.includes("Could not establish connection")) {
              // console.log("Streamkeys: Tab communication failed, attempting recovery for tab:", request.tab_target);

              // Try to re-inject controller and retry command
              chrome.tabs.get(request.tab_target, (tab) => {
                if (!chrome.runtime.lastError && tab && skSites) {
                  const controller = skSites.getController(tab.url);
                  if (controller) {
                    // console.log("Streamkeys: Re-injecting controller for recovery:", controller);
                    chrome.scripting.executeScript({
                      target: { tabId: request.tab_target },
                      files: [controller]
                    }, function() {
                      if (!chrome.runtime.lastError) {
                        // Retry the command after a brief delay
                        setTimeout(() => {
                          chrome.tabs.sendMessage(request.tab_target, { action: request.command }, function() {
                            if (chrome.runtime.lastError) {
                              // console.log("Streamkeys: Retry command also failed:", chrome.runtime.lastError.message);
                            } else {
                              // console.log("Streamkeys: Command succeeded after recovery");
                            }
                          });
                        }, 500);
                      }
                    });
                  }
                }
              });
            }
          } else {
            // console.log("Streamkeys: Command sent successfully, response:", response);
          }
        });
      } else {
        // Send command to all music tabs
        sendAction(request.command);
      }
      sendResponse({ success: true });
      return;
    }

    if (request.action === "clear_disabled_tabs") {
      // console.log("CLEARING ALL DISABLED TABS - Debug command"); // #!# DEBUG
      const beforeCount = disabledTabs.length;
      disabledTabs = [];
      // console.log("Streamkeys: Cleared", beforeCount, "disabled tabs from memory and storage"); // #!# DEBUG

      // Also clear from storage
      saveDisabledTabs().then(() => {
        sendResponse({ success: true, cleared: beforeCount });
      }).catch(error => {
        // console.error("Streamkeys: Failed to clear disabled tabs from storage:", error);
        sendResponse({ success: true, cleared: beforeCount, storageError: error.message });
      });
      return true; // Async response
    }

    if (request.action === "toggle_enabled") {
      // console.log("Streamkeys: Toggle enabled for tab:", request.tab_target, "enabled:", request.enabled); // #!# DEBUG - always show
      const tabId = parseInt(request.tab_target);

      if (isNaN(tabId)) {
        // console.error("Streamkeys: Invalid tab ID for toggle_enabled:", request.tab_target);
        sendResponse({ success: false, error: "Invalid tab ID" });
        return;
      }

      const beforeLength = disabledTabs.length;
      // console.log("Streamkeys: Current disabled tabs before change:", [...disabledTabs]); // #!# DEBUG

      if (request.enabled) {
        // Remove from disabled tabs (enable the tab)
        disabledTabs = disabledTabs.filter(id => id !== tabId);
        // console.log("Streamkeys: Enabled tab", tabId, "- removed from disabled list. Before:", beforeLength, "After:", disabledTabs.length); // #!# DEBUG
      } else {
        // Add to disabled tabs (disable the tab)
        if (!disabledTabs.includes(tabId)) {
          disabledTabs.push(tabId);
          // console.log("Streamkeys: Disabled tab", tabId, "- added to disabled list. Total disabled:", disabledTabs.length); // #!# DEBUG
        } else {
          // console.log("Streamkeys: Tab", tabId, "already in disabled list"); // #!# DEBUG
        }
      }

      // console.log("Streamkeys: Updated disabled tabs:", [...disabledTabs]); // #!# DEBUG

      // ENHANCED: Save disabled tabs to storage for MV2/MV3 hybrid persistence
      saveDisabledTabs().then(() => {
        // console.log("Streamkeys: Tab enable/disable operation completed with storage persistence"); // #!# DEBUG
        sendResponse({ success: true, enabled: request.enabled, disabledCount: disabledTabs.length });
      }).catch(error => {
        // console.error("Streamkeys: Failed to save disabled tabs:", error);
        // Still respond with success since the in-memory operation worked
        sendResponse({ success: true, enabled: request.enabled, disabledCount: disabledTabs.length });
      });
      return true; // Async response
    }

    if (request.action === "update_player_state") {
      // console.log("Streamkeys: Received update_player_state from tab", sender.tab.id, "URL:", sender.tab.url); // #!# DEBUG
      // console.log("Streamkeys: State data:", request.stateData); // #!# DEBUG

      tabStates[sender.tab.id] = {
        "timestamp": Date.now(),
        "state": request.stateData
      };

      console.log("Background: Updated tab states, now tracking", Object.keys(tabStates).length, "tabs");

      // ENHANCED: Save tab states to storage for MV2-style persistence
      saveTabStates();

      console.log("Background: Sending update_popup_state message to popup");
      chrome.runtime.sendMessage({
        action: "update_popup_state",
        stateData: request.stateData,
        fromTab: sender.tab
      }).catch(() => {
        console.log("Background: Popup not open, couldn't send update");
        // Popup may not be open, ignore errors
      });
      // TODO: MPRIS support if needed
      sendResponse({ received: true });
      return;
    }

    if (request.action && typeof sendAction === "function") {
      sendAction(request.action);
      sendResponse({ success: true });
      return;
    }

    // console.warn("Streamkeys: Unhandled message:", request);
    sendResponse({ error: "Unknown action" });

  } catch (error) {
    // console.error("Streamkeys: Error handling message:", error);
    sendResponse({ error: error.message });
  }
});

/**
 * Tab removal handler - clean up state (MV2-style cleanup with persistence)
 */
chrome.tabs.onRemoved.addListener(function(tabId) {
  // console.log("Streamkeys: Tab", tabId, "was closed, cleaning up..."); // #!# DEBUG

  if (tabStates[tabId]) {
    delete tabStates[tabId];
    // Save updated tab states to storage for MV2-style persistence
    saveTabStates().catch(error => {
      // console.error("Streamkeys: Failed to save tab states after tab removal:", error);
    });
    // console.log("Streamkeys: Cleaned up state for closed tab:", tabId);
  }

  // Also remove from disabled tabs list when tab is closed and save to storage
  const originalLength = disabledTabs.length;
  disabledTabs = disabledTabs.filter(id => id !== tabId);

  // Only save if the array actually changed
  if (disabledTabs.length !== originalLength) {
    // console.log("Streamkeys: Removed closed tab", tabId, "from disabled list, saving to storage"); // #!# DEBUG
    saveDisabledTabs().catch(error => {
      // console.error("Streamkeys: Failed to save disabled tabs after tab removal:", error);
    });
  }
});

/**
 * Tab activation handler - update popup when user switches tabs (MV2-style)
 */
chrome.tabs.onActivated.addListener(function(activeInfo) {
  console.log("Background: Tab", activeInfo.tabId, "activated");

  // If the newly active tab has music player state, notify popup for real-time updates
  if (tabStates[activeInfo.tabId]) {
    console.log("Background: Active tab has player state, sending update to popup");
    chrome.runtime.sendMessage({
      action: "update_popup_state",
      stateData: tabStates[activeInfo.tabId].state,
      fromTab: { id: activeInfo.tabId }
    }).catch(() => {
      // Popup may not be open, ignore errors
    });
  }
});

/**
 * Extension context invalidated handler
 */
chrome.runtime.onConnect.addListener(function(port) {
  port.onDisconnect.addListener(function() {
    if (chrome.runtime.lastError) {
      // console.log("Streamkeys: Port disconnected:", chrome.runtime.lastError.message);
    }
  });
});

// console.log("Streamkeys MV3 Service Worker loaded successfully");

