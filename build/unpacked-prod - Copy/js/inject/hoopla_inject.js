(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
(function() {
  var sk_log = require("../modules/SKLog.js");
  if (typeof window.jwplayer === "function") {
    // Make the play state available in the DOM
    $("body").append("<div id='sk-state' class='sk-play'>");

    var onPlayPauseRegistered = false;

    document.addEventListener("streamkeys-cmd", function(e) {
      var jw = window.jwplayer();
      if (!jw) {
        return;
      }

      // Register onPlay and onPause callbacks to toggle state
      if (!onPlayPauseRegistered) {
        jw.onPlay(function() {
          $("#sk-state").removeClass("sk-pause").addClass("sk-play");
        });
        jw.onPause(function() {
          $("#sk-state").removeClass("sk-play").addClass("sk-pause");
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

},{"../modules/SKLog.js":2}],2:[function(require,module,exports){
"use strict";
(function() {
  /**
   * Log messages to console with prepended message.
   * @param msg {String} message to log
   * @param [obj] {Object} object to dump with message
   * @param [err] {Boolean} TRUE if the message is an error
   */
  module.exports = function(msg, obj, err) {
    if(msg) {
      obj = obj || "";
      if(err) {
        console.error("STREAMKEYS-ERROR: " + msg, obj);
        msg = "ERROR: " + msg;
      } else {
        console.log("STREAMKEYS-INFO: " + msg, obj);
      }
    }
  };
})();

},{}]},{},[1]);
