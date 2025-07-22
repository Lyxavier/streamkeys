(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
(function() {
  var MouseEventController = require("MouseEventController");
  var yandexRadioController = new MouseEventController({
    siteName: "Yandex Radio",

    playPause: ".player-controls__play",
    playNext: ".slider__item_next",
    playState: ".body_state_playing",

    mute: ".volume__btn",
    like: ".player-controls .like_action_like",
    dislike: ".player-controls .like_action_dislike",

    song: ".player-controls__title",
    artist: ".player-controls__artists"
  });

  // override mute
  yandexRadioController.mute = function() {
    this.mousedown({action: "mute", selectorButton: this.selectors.mute, selectorFrame: this.selectors.iframe});
  };
})();

},{"MouseEventController":3}],2:[function(require,module,exports){
"use strict";
(function() {
  var sk_log = require("../modules/SKLog.js");

  function BaseController(options) {
    this.siteName = options.siteName || null;

    this.selectors = {
      //** Properties **//
      playPause: (options.playPause || null),
      play: (options.play || null),
      pause: (options.pause || null),
      playNext: (options.playNext || null),
      playPrev: (options.playPrev || null),
      mute: (options.mute || null),
      like: (options.like || null),
      confirmLike: (options.confirmLike || null),
      dislike: (options.dislike || null),
      confirmDislike: (options.confirmDislike || null),
      iframe: (options.iframe || null),

      //** States **//
      playState: (options.playState || null),

      //** Song Info **//
      song: (options.song || null),
      artist: (options.artist || null),
      album: (options.album || null),
      art: (options.art || null),
      currentTime: (options.currentTime || null),
      totalTime: (options.totalTime || null)
    };

    // Any property that's a function, turn it into a getter
    Object.defineProperties(
      this.selectors,
      Object.keys(this.selectors)
        .reduce(function(properties, key) {
          var fn = this.selectors[key];
          if (typeof fn === "function") {
            properties[key] = {
              get: fn.bind(this)
            };
          }
          return properties;
        }.bind(this), {}));

    // Previous player state, used to check vs current player state to see if anything changed
    this.oldState = {};

    // Set to true if the play/pause buttons share the same element
    this.buttonSwitch = options.buttonSwitch || false;

    // Default listener sends actions to main document
    this.attachListeners();

    // Set to true if the tab should be hidden from the popup unless it has a playPause element shown
    this.hidePlayer = options.hidePlayer || false;

    //** Overrides for popup buttons **//
    this.overridePlayPrev = options.overridePlayPrev || false;
    this.overridePlayPause = options.overridePlayPause || false;
    this.overridePlayNext = options.overridePlayNext || false;

    chrome.runtime.sendMessage({ created: true }, function() {
      sk_log("SK content script loaded");
    });
  }

  BaseController.prototype.doc = function() {
    var returnDoc = document;
    if (this.selectors.iframe) {
      if (document.querySelector(this.selectors.iframe)) {
        if (document.querySelector(this.selectors.iframe).tagName.indexOf("FRAME") > -1) {
          returnDoc = document.querySelector(this.selectors.iframe).contentWindow.document;
        }
      }
    }
    return returnDoc;
  };

  /**
   * Inject a script into the current document
   * @param {String} file.url - /relative/path/to/script
   * @param {String} file.script - plaintext script as a string
   */
  BaseController.prototype.injectScript = function(file) {
    var script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    if(file.url) {script.setAttribute("src", chrome.extension.getURL(file.url));}
    if(file.script) {script.innerHTML = file.script;}
    (document.head || document.documentElement).appendChild(script);
  };

  /**
   * Click inside document
   * @param {String} opts.selectorButton - css selector for button to click
   * @param {String} opts.action - name of action to log to console for debugging purposes
   * @param {String} [opts.selectorFrame] - css selector for iframe to send clicks to
   */
  BaseController.prototype.click = function(opts) {
    opts = opts || {};
    if(opts.selectorButton === null) {
      sk_log("disabled", opts.action);
      return;
    }

    try {
      this.doc().querySelector(opts.selectorButton).click();
      sk_log(opts.action);
    } catch(e) {
      sk_log("Element not found for click.", opts.selectorButton, true);
    }

    // Update the player state after a click
    this.updatePlayerState();
  };

  BaseController.prototype.playPause = function() {
    if(this.selectors.play !== null && this.selectors.pause !== null) {
      if(this.isPlaying()) {
        this.click({action: "playPause", selectorButton: this.selectors.pause, selectorFrame: this.selectors.iframe});
      } else {
        this.click({action: "playPause", selectorButton: this.selectors.play, selectorFrame: this.selectors.iframe});
      }
    } else {
      this.click({action: "playPause", selectorButton: this.selectors.playPause, selectorFrame: this.selectors.iframe});
    }
  };

  BaseController.prototype.playNext = function() {
    this.click({action: "playNext", selectorButton: this.selectors.playNext, selectorFrame: this.selectors.iframe});
  };

  BaseController.prototype.playPrev = function() {
    this.click({action: "playPrev", selectorButton: this.selectors.playPrev, selectorFrame: this.selectors.iframe});
  };

  BaseController.prototype.stop = function() {
    if(this.isPlaying()) this.playPause();
  };

  BaseController.prototype.mute = function() {
    this.click({action: "mute", selectorButton: this.selectors.mute, selectorFrame: this.selectors.iframe});
  };

  BaseController.prototype.like = function() {
    this.click({action: "like", selectorButton: this.selectors.like, selectorFrame: this.selectors.iframe});
    if(this.selectors.confirmLike !== null) {
      var controller = this;
      var observer = new MutationObserver(function() {
        this.disconnect();
        controller.click({action: "confirmLike", selectorButton: controller.selectors.confirmLike, selectorFrame: controller.selectors.iframe});
      });
      observer.observe(document.documentElement, {childList: true, subtree: true});
    }
  };

  BaseController.prototype.dislike = function() {
    this.click({action: "dislike", selectorButton: this.selectors.dislike, selectorFrame: this.selectors.iframe});
    if(this.selectors.confirmDislike !== null) {
      var controller = this;
      var observer = new MutationObserver(function() {
        this.disconnect();
        controller.click({action: "confirmDislike", selectorButton: controller.selectors.confirmDislike, selectorFrame: controller.selectors.iframe});
      });
      observer.observe(document.documentElement, {childList: true, subtree: true});
    }
  };

  /**
   * Attempts to check if the site is playing anything
   * @return {Boolean} true if site is currently playing
   */
  BaseController.prototype.isPlaying = function() {
    var playEl = this.doc().querySelector(this.selectors.play),
      isPlaying = false;

    if(this.buttonSwitch) {
      // If playEl does not exist then it is currently playing
      isPlaying = (playEl === null);
    }
    else if(this.selectors.playState) {
      // Check if the play state element exists and is visible
      var playStateEl = this.doc().querySelector(this.selectors.playState);
      isPlaying = !!(playStateEl && (window.getComputedStyle(playStateEl, null).getPropertyValue("display") !== "none"));
    }
    else if(playEl) {
      isPlaying = (window.getComputedStyle(playEl, null).getPropertyValue("display") === "none");
    }

    return isPlaying;
  };

  /**
   * Gets the current state of the music player and passes data to background page (and eventually popup)
   */
  BaseController.prototype.updatePlayerState = function() {
    if(this.checkPlayer) this.checkPlayer();

    var newState = this.getStateData();
    if(JSON.stringify(newState) !== JSON.stringify(this.oldState)) {
      sk_log("Player state change");
      if(this.getSongChanged(newState)) {
        chrome.runtime.sendMessage({
          action: "send_change_notification",
          stateData: newState
        });
      }
      this.oldState = newState;
      chrome.runtime.sendMessage({
        action: "update_player_state",
        stateData: newState
      });
    }
  };

  /**
   * Gets an object containing the current player state data
   * @return {{song: {String}, artist: {String}, isPlaying: {Boolean}, siteName: {String}}}
   */
  BaseController.prototype.getStateData = function() {
    return {
      song: (this.getSongData(this.selectors.song) === null ? null : this.getSongData(this.selectors.song).replace(/\s+/g, " ")),
      artist: (this.getSongData(this.selectors.artist) === null ? null : this.getSongData(this.selectors.artist).replace(/\s+/g, " ")),
      album: (this.getSongData(this.selectors.album) === null ? null : this.getSongData(this.selectors.album).replace(/\s+/g, " ")),
      art: this.getArtData(this.selectors.art),
      currentTime: this.getSongData(this.selectors.currentTime),
      totalTime: this.getSongData(this.selectors.totalTime),
      isPlaying: this.isPlaying(),
      siteName: (this.siteName == null ? null : this.siteName.replace(/\s+/g, " ")),
      canDislike: !!(this.selectors.dislike && this.doc().querySelector(this.selectors.dislike)),
      canPlayPrev: this.overridePlayPrev || !!(this.selectors.playPrev && this.doc().querySelector(this.selectors.playPrev)),
      canPlayPause: this.overridePlayPause || !!(
        (this.selectors.playPause && this.doc().querySelector(this.selectors.playPause)) ||
        (this.selectors.play && this.doc().querySelector(this.selectors.play)) ||
        (this.selectors.pause && this.doc().querySelector(this.selectors.pause))
      ),
      canPlayNext: this.overridePlayNext || !!(this.selectors.playNext && this.doc().querySelector(this.selectors.playNext)),
      canLike: !!(this.selectors.like && this.doc().querySelector(this.selectors.like)),
      hidePlayer: this.hidePlayer
    };
  };

  /**
   * Returns a bool indicating whether the player's song changed since the last state update
   * @param {{song: {String}}} newState - new state object
   * @return {Boolean} true if song just changed, false otherwise
   */
  BaseController.prototype.getSongChanged = function(newState) {
    return this.oldState &&
            newState &&
            this.oldState.song !== newState.song;
  };

  /**
   * Gets the text value from a song data selector
   * @param {String} selector - selector for song data
   * @return {*} song data if element is found, null otherwise
   */
  BaseController.prototype.getSongData = function(selector) {
    if(!selector) return null;

    var dataEl = this.doc().querySelector(selector);
    if(dataEl && dataEl.textContent) {
      return dataEl.textContent;
    }

    return null;
  };

  BaseController.prototype.getArtData = function(selector) {
    if(!selector) return null;

    var dataEl = this.doc().querySelector(selector);
    if(dataEl && dataEl.attributes && dataEl.attributes.src) {
      return dataEl.attributes.src.value;
    }

    return null;
  };

  /**
   * Callback for request from background page
   */
  BaseController.prototype.doRequest = function(request, sender, response) {
    if(typeof request !== "undefined") {
      if(request.action === "playPause") this.playPause();
      if(request.action === "playNext") this.playNext();
      if(request.action === "playPrev") this.playPrev();
      if(request.action === "stop") this.stop();
      if(request.action === "mute") this.mute();
      if(request.action === "like") this.like();
      if(request.action === "dislike") this.dislike();
      if(request.action === "playerStateNotify"){
        chrome.runtime.sendMessage({
          action: "send_change_notification",
          stateData: this.getStateData()
        });
      }
      if(request.action === "getPlayerState") {
        var newState = this.getStateData();
        this.oldState = newState;
        response(newState);
      }
    }
  };

  /**
   * Setup listeners for extension messages. Initialize the playerState interval
   */
  BaseController.prototype.attachListeners = function() {
    // Listener for requests from background page
    chrome.runtime.onMessage.addListener(this.doRequest.bind(this));

    // Update the popup player state intermittently
    setInterval(this.updatePlayerState.bind(this), 200);

    sk_log("Attached listener for ", this);
  };

  module.exports = BaseController;
})();

},{"../modules/SKLog.js":5}],3:[function(require,module,exports){
"use strict";
(function() {
  var BaseController = require("BaseController"),
    MouseEventDispatcher = require("../modules/MouseEventDispatcher.js"),
    sk_log = require("../modules/SKLog.js");

  /**
   * @class MouseEventController
   * @extends BaseController
   * @constructor
   */
  function MouseEventController() {
    BaseController.apply(this, arguments);
  }

  MouseEventController.prototype = Object.create(BaseController.prototype);
  MouseEventController.prototype.constructor = MouseEventController;

  /**
   * Dispatch "mouseclick" mouse "click" event inside document
   * @param {String} opts.selectorButton - css selector for element
   */

  /**
   * Dispatch "dblclick" mouse event inside document
   * @param {String} opts.selectorButton - css selector for element
   */

  /**
   * Dispatch "mousedown" mouse event inside document
   * @param {String} opts.selectorButton - css selector for element
   */

  /**
   * Dispatch "mouseenter" mouse event inside document
   * @param {String} opts.selectorButton - css selector for element
   */

  /**
   * Dispatch "mouseleave" mouse event inside document
   * @param {String} opts.selectorButton - css selector for element
   */

  /**
   * Dispatch "mousemove" mouse event inside document
   * @param {String} opts.selectorButton - css selector for element
   */

  /**
   * Dispatch "mouseout" mouse event inside document
   * @param {String} opts.selectorButton - css selector for element
   */

  /**
   * Dispatch "mouseover" mouse event inside document
   * @param {String} opts.selectorButton - css selector for element
   */

  /**
   * Dispatch "mouseup" mouse event inside document
   * @param {String} opts.selectorButton - css selector for element
   */

  MouseEventDispatcher.eachTypes(function(eventType) {
    // no override
    if (Object.prototype.hasOwnProperty.call(BaseController.prototype,eventType)) {
      return;
    }
    // based on click method
    MouseEventController.prototype[eventType] = function(opts, mouseOpts) {
      opts = opts || {};
      if (opts.selectorButton === null) {
        sk_log("disabled", opts.action);
        return;
      }
      try {
        var button = this.doc().querySelector(opts.selectorButton);
        MouseEventDispatcher.dispatch(button, eventType, mouseOpts);
        if (opts.action) {
          sk_log(opts.action);
        }
      } catch (e) {
        sk_log("Element not found for " + eventType + ".", opts.selectorButton, true);
      }

      this.updatePlayerState();
    };
  });

  module.exports = MouseEventController;
})();

},{"../modules/MouseEventDispatcher.js":4,"../modules/SKLog.js":5,"BaseController":2}],4:[function(require,module,exports){
"use strict";
(function() {
  /**
   * @typedef {Object} MouseEventOptions
   * @property {Boolean} canBubble - Whether or not the event can bubble.
   * @property {Boolean} cancelable - Whether or not the event's default action can be prevented.
   *
   * @property {AbstractView} view - The event's AbstractView. You should pass the window object here.
   * @property {Number} detail - The event's mouse click count.
   *
   * @property {Number} screenX - The event's screen x coordinate.
   * @property {Number} screenY - The event's screen y coordinate.
   * @property {Number} clientX - The event's client x coordinate.
   * @property {Number} clientY - The event's client y coordinate.
   *
   * @property {Boolean} ctrlKey - Whether or not control key was depressed during the Event.
   * @property {Boolean} altKey - Whether or not alt key was depressed during the Event.
   * @property {Boolean} shiftKey - Whether or not shift key was depressed during the Event.
   * @property {Boolean} metaKey - Whether or not meta key was depressed during the Event.
   *
   * @property {Number} button - The event's mouse button.
   * @property {EventTarget} relatedTarget - The event's related EventTarget. Only used with some event types (e.g. mouseover and mouseout). In other cases, pass null.
   */

  /**
   * @class MouseEventDispatcher
   * @classdesc Mouse event dispatcher.
   * @static
   */
  function MouseEventDispatcher() {
    throw "MouseEventDispatcher cannot be instantiated.";
  }

  /**
   * Possible types for mouse event.
   *
   * @name MouseEventDispatcher.eventTypes
   * @type String[]
   * @static
   */
  MouseEventDispatcher.eventTypes = [
    "mouseclick",
    "dblclick",
    "mousedown",
    "mouseenter",
    "mouseleave",
    "mousemove",
    "mouseout",
    "mouseover",
    "mouseup",
  ];

  /**
   * Dispatch custom mouse event.
   *
   * @memberof MouseEventDispatcher
   * @method dispatch
   * @param {(HTMLElement|String)} target - Target element or selector.
   * @param {String} eventType - Mouse event type, e.g. "click", "dblclick", "mousedown", etc.
   * @param {MouseEventOptions} [options] - Mouse event options. More info: {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/initMouseEvent}
   * @static
   */
  MouseEventDispatcher.dispatch = function(target, eventType, options) {
    if (typeof target === "string") {
      target = document.querySelector(target);
    }

    // XXX: Dumb case so we don't overrite BaseController::click
    if (eventType === "mouseclick") {
      eventType = "click";
    }

    options = options || {};

    var event = document.createEvent("MouseEvents");
    event.initMouseEvent(
      eventType,
      options.canBubble || true,
      options.cancelable || true,

      options.view || window,
      options.detail || 1,

      options.screenX || 0,
      options.screenY || 0,
      options.clientX || 0,
      options.clientY || 0,

      options.ctrlKey || false,
      options.altKey || false,
      options.shiftKey || false,
      options.metaKey || false,

      options.button || 0,
      options.relatedTarget || null
    );

    target.dispatchEvent(event);
  };

  /**
   * Call handler for each mouse event types.
   *
   * @memberof MouseEventDispatcher
   * @method eachTypes
   * @param {Function} handler
   * @static
   */
  MouseEventDispatcher.eachTypes = function(handler) {
    for (var i = 0; i < this.eventTypes.length; i++) {
      handler(this.eventTypes[i]);
    }
  };

  // Extend class by event type.

  /**
   * @memberof MouseEventDispatcher
   * @method mouseclick
   * @param {(HTMLElement|String)} target
   * @param {MouseEventOptions} [options]
   * @static
   */

  /**
   * @memberof MouseEventDispatcher
   * @method dblclick
   * @param {(HTMLElement|String)} target
   * @param {MouseEventOptions} [options]
   * @static
   */

  /**
   * @memberof MouseEventDispatcher
   * @method mousedown
   * @param {(HTMLElement|String)} target
   * @param {MouseEventOptions} [options]
   * @static
   */

  /**
   * @memberof MouseEventDispatcher
   * @method mouseenter
   * @param {(HTMLElement|String)} target
   * @param {MouseEventOptions} [options]
   * @static
   */

  /**
   * @memberof MouseEventDispatcher
   * @method mouseleave
   * @param {(HTMLElement|String)} target
   * @param {MouseEventOptions} [options]
   * @static
   */

  /**
   * @memberof MouseEventDispatcher
   * @method mousemove
   * @param {(HTMLElement|String)} target
   * @param {MouseEventOptions} [options]
   * @static
   */

  /**
   * @memberof MouseEventDispatcher
   * @method mouseout
   * @param {(HTMLElement|String)} target
   * @param {MouseEventOptions} [options]
   * @static
   */

  /**
   * @memberof MouseEventDispatcher
   * @method mouseover
   * @param {(HTMLElement|String)} target
   * @param {MouseEventOptions} [options]
   * @static
   */

  /**
   * @memberof MouseEventDispatcher
   * @method mouseup
   * @param {(HTMLElement|String)} target
   * @param {MouseEventOptions} [options]
   * @static
   */

  MouseEventDispatcher.eachTypes(function(eventType) {
    MouseEventDispatcher[eventType] = function(target, options) {
      MouseEventDispatcher.dispatch(target, eventType, options);
    };
  });

  module.exports = MouseEventDispatcher;
})();

},{}],5:[function(require,module,exports){
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
