(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
(function() {
  var sk_log = require("../modules/SKLog.js");
  document.addEventListener("streamkeys-cmd", function(e) {
    if(e.detail === "next") {
      try {
        $(".p_avancar").mousedown().mouseup();
        sk_log("playNext");
      } catch (exception) {
        sk_log("playNext", exception, true);
      }
    } else if(e.detail === "prev") {
      try {
        $(".p_voltar").mousedown().mouseup();
        sk_log("playPrev");
      } catch (exception) {
        sk_log("playPrev", exception, true);
      }
    }
  });
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
