(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
(function() {
  if (window.MusicKit) {
    addEventListeners();
  } else {
    document.addEventListener("musickitloaded", addEventListeners);
  }

  function addEventListeners() {
    var Events = window.MusicKit.Events;
    var player = window.MusicKit.getInstance().player;
    player.addEventListener(Events.metadataDidChange, sendState);
    player.addEventListener(Events.playbackStateDidChange, sendState);
  }

  function sendState() {
    var event = new CustomEvent("streamkeys-state", {detail: getState()});
    document.dispatchEvent(event);
  }

  function getState() {
    var player = window.MusicKit.getInstance().player;
    var item = player.nowPlayingItem;
    return {
      albumName: item.albumName,
      artistName: item.artistName,
      artworkURL: item.artworkURL,
      title: item.title,
      isPlaying: player.isPlaying
    };
  }

  document.addEventListener("streamkeys-cmd", function(e) {
    var musicKit = window.MusicKit.getInstance();
    switch (e.detail) {
    case "playPause":
      if (musicKit.player.isPlaying) {
        musicKit.pause();
      } else {
        musicKit.play();
      }
      break;
    case "next":
      musicKit.skipToNextItem();
      break;
    case "prev":
      musicKit.skipToPreviousItem();
      break;
    case "stop":
      musicKit.stop();
      break;
    }
  });
})();

},{}]},{},[1]);
