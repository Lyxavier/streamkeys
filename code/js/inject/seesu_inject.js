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

  document.addEventListener("streamkeys-cmd", function(e) {
    //Get seesu current song object (thanks Gleb!)
    var song = window.su.p && window.su.p.c_song;
    if(song) {
      if(e.detail === "playPause") {
        if(song.states.play) {
          try {
            song.pause();
            sk_log("playPause");
          } catch (exception) {
            sk_log("playPause", exception, true);
          }
        } else {
          try {
            song.play();
            sk_log("playPause");
          } catch (exception) {
            sk_log("playPause", exception, true);
          }
        }
      } else if(e.detail === "next") {
        try {
          song.playNext();
          sk_log("playNext");
        } catch (exception) {
          sk_log("playNext", exception, true);
        }
      } else if(e.detail === "prev") {
        try {
          song.playPrev();
          sk_log("playPrev");
        } catch (exception) {
          sk_log("playPrev", exception, true);
        }
      }
    }
  });

})();
