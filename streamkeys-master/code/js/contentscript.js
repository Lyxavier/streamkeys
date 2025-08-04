"use strict";
(function() {
  // #!# console.log("Streamkeys contentscript loaded on:", window.location.href);

  // Global message listener - this will be the primary handler
  var contentScriptListener = function(request, sender, sendResponse) {
    // #!# console.log("Content script received message:", request.action, request);
    // #!# console.log("Content script: Current controller state:", !!window.streamkeysController);

    // If we have a controller, delegate to it
    if (window.streamkeysController) {
      // #!# console.log("Content script: Delegating to controller");

      if (request.action === "getPlayerState" && typeof window.streamkeysController.getPlayerState === "function") {
        try {
          var state = window.streamkeysController.getPlayerState();
          // #!# console.log("Content script: Got state from controller:", state);
          sendResponse(state);
          return true;
        } catch (error) {
          // #!# console.error("Content script: Error getting state from controller:", error);
          sendResponse(null);
          return true;
        }
      } else if (request.action && typeof window.streamkeysController.handleAction === "function") {
        try {
          window.streamkeysController.handleAction(request.action);
          sendResponse({success: true});
          return true;
        } catch (error) {
          // #!# console.error("Content script: Error handling action:", error);
          sendResponse({success: false, error: error.message});
          return true;
        }
      }
    }

    // #!# console.log("Content script: No controller available, providing fallback response");

    if (request.action === "getPlayerState") {
      // #!# console.log("Content script: Providing fallback getPlayerState response");
      sendResponse({
        siteName: "YouTube",
        song: document.title || "Unknown",
        artist: "",
        isPlaying: false,
        canPlayPause: true,
        canPlayNext: true,
        canPlayPrev: true
      });
      return true;
    }

    if (request.action) {
      // #!# console.log("Content script: Received action but no controller available:", request.action);
      sendResponse({success: false, error: "No controller available"});
      return true;
    }

    return false;
  };

  chrome.runtime.onMessage.addListener(contentScriptListener);

  chrome.runtime.sendMessage({ action: "check_music_site" }, function(response) {
    // #!# console.log("check_music_site response:", response, "for URL:", window.location.href);

    if (chrome.runtime.lastError) {
      console.error("Error checking music site:", chrome.runtime.lastError.message);
      return;
    }

    // Register this content script as ready for communication
    chrome.runtime.sendMessage({
      action: "content_script_ready",
      url: window.location.href
    }, function() {
      if (chrome.runtime.lastError) {
        console.log("Could not register content script:", chrome.runtime.lastError.message);
      }
    });

    if(response && response !== "no_inject") {
      // #!# console.log("Site detected as music site, getting controller...");

      chrome.runtime.sendMessage({ action: "get_site_controller" }, function(controller) {
        // #!# console.log("get_site_controller response:", controller);

        if (chrome.runtime.lastError) {
          console.error("Error getting site controller:", chrome.runtime.lastError.message);
          return;
        }

        // Define helper functions at function body root to avoid ESLint no-inner-declarations
        function waitAndInject(controllerPath) {
          setTimeout(function() {
            injectController(controllerPath);
          }, 500); // Give background script time to initialize
        }

        function injectController(controllerPath, retryCount) {
          if (typeof retryCount === "undefined") retryCount = 0;

          chrome.runtime.sendMessage({
            action: "inject_controller",
            file: controllerPath
          }, function(response) { // eslint-disable-line no-unused-vars
            if (chrome.runtime.lastError) {
              if (chrome.runtime.lastError.message.includes("message channel closed") && retryCount < 3) {
                // #!# console.log("Background script not ready, retrying injection...", retryCount + 1);
                setTimeout(function() {
                  injectController(controllerPath, retryCount + 1);
                }, 1000);
                return;
              }
              console.error("Error injecting controller:", chrome.runtime.lastError.message);
            } else {
              // #!# console.log("Controller injection response:", response);

              // Add a small delay to allow controller to initialize
              setTimeout(function() {
                // #!# console.log("Content script: Controller should be ready now, checking:", !!window.streamkeysController);
                if (window.streamkeysController) {
                  // #!# console.log("Content script: Controller successfully loaded:", window.streamkeysController.siteName);
                } else {
                  console.error("Content script: Controller not found after injection!");
                }
              }, 100);
            }
          });
        }

        if(controller) {
          // Controller path is already complete from background script (e.g., "js/controllers/youtube.js")
          console.log("Injecting controller:", controller);

          waitAndInject(controller);
        } else {
          console.log("No controller found for this site");
        }
      });
    } else {
      console.log("Site not detected as music site");
    }
  });
})();
