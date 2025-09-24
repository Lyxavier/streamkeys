"use strict";
(function() {
  // Inline SKLog functionality for MV3 compatibility
  function sk_log(msg, obj, err) {
    if(msg) {
      obj = obj || "";
      if(err) {
        console.error("STREAMKEYS-ERROR: " + msg, obj);
      } else {
        console.log("STREAMKEYS-INFO: " + msg, obj);
      }
    }
  }

  // Vanilla JS helper for jQuery methods
  function addStateElement() {
    if (typeof $ !== "undefined") {
      $("body").append("<div id='sk-state' class='sk-play'>");
    } else {
      // Vanilla JS fallback
      const stateDiv = document.createElement("div");
      stateDiv.id = "sk-state";
      stateDiv.className = "sk-play";
      document.body.appendChild(stateDiv);
    }
  }

  if (typeof window.jwplayer === "function") {
    // Make the play state available in the DOM
    addStateElement();

    var onPlayPauseRegistered = false;

    document.addEventListener("streamkeys-cmd", function(e) {
      var jw = window.jwplayer();
      if (!jw) {
        return;
      }

      // Register onPlay and onPause callbacks to toggle state
      if (!onPlayPauseRegistered) {
        jw.onPlay(function() {
          const stateEl = document.getElementById("sk-state");
          if (stateEl) {
            stateEl.classList.remove("sk-pause");
            stateEl.classList.add("sk-play");
          }
        });
        jw.onPause(function() {
          const stateEl = document.getElementById("sk-state");
          if (stateEl) {
            stateEl.classList.remove("sk-play");
            stateEl.classList.add("sk-pause");
          }
        });
      }
      onPlayPauseRegistered = true;

      try {
        switch (e.detail) {
        case "playPause":
          jw.pause();
          break;
        case "next":
          jw.playlistNext();
          break;
        case "prev":
          jw.playlistPrev();
          break;
        case "mute":
          jw.setMute();
          break;
        case "stop":
          jw.stop();
          break;
        }
      } catch (exception) {
        sk_log(e.detail, exception, true);
      }
    });
  }
})();
