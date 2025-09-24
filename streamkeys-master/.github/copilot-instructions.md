# GitHub Copilot Instructions for Streamkeys Extension

This document provides comprehensive guidance for AI coding agents working on the Streamkeys Chrome Extension project.

## � User-Requested Features, Changes & Removals

### ✅ **Features Added/Fixed**
- **Enhanced Global Hotkeys Recovery** - Service worker restart detection and automatic state recovery
- **Hybrid Tab State Persistence** - MV2-style storage persistence combined with active polling
- **Reactive UI System** - Custom Observable pattern preventing UI flicker during updates
- **Fixed Disabled Sites Behavior** - Disabled sites remain visible instead of disappearing from popup
- **Enhanced Debug Logging** - Comprehensive logging system with `#!#` markers for debugging
- **Periodic Health Checks** - Automatic command listener and state recovery monitoring
- **Tab Navigation on Click** - Site title links navigate to the respective browser tab
- **Play/Pause Button Fixes** - Removed optimistic updates to prevent multiple toggles

### 🔄 **Changes Made**
- **MV2 → MV3 Migration** - Complete service worker architecture implementation
- **Knockout.js → Custom Observables** - Lightweight reactive system replacing external dependency
- **Tab State Management** - Unified collection approach for both enabled and disabled sites
- **Button State Logic** - Improved disabled site controls (allow pause, prevent play when stopped)
- **Priority System** - Enhanced site priority management with reactive updates
- **Song Text Display** - Improved marquee scrolling with overflow detection and animation controls

### ❌ **Features Removed**
- **Like/Dislike Buttons** - Removed completely per user request ("UI looks broke to fuck")
- **Disabled Sites Toggle Section** - Removed broken toggle to prevent UI breakage
- **Loading States** - Removed loading indicators for instant popup response
- **Optimistic UI Updates** - Removed from play/pause to prevent multiple toggle issues
- **External CDN Dependencies** - Removed for MV3 CSP compliance
- **Background Page Variables** - Replaced with persistent storage for service worker compatibility

### 🐛 **Issues Resolved**
- **Global Hotkeys Stop Working** - Fixed service worker restart handling
- **Tab Persistence Problems** - Implemented enhanced recovery system
- **Play/Pause Multiple Toggles** - Fixed by removing optimistic updates
- **Disabled Sites Disappearing** - Fixed by keeping all tabs in main collection
- **ESLint Errors** - Fixed trailing spaces and unused variables
- **UI Flicker** - Eliminated through reactive binding system
- **Service Worker State Loss** - Fixed with hybrid storage approach

## �🔧 Project Overview

**Streamkeys** is a Chrome extension that enables global media keys control for 50+ music streaming websites. The project recently migrated from Manifest V2 to V3, implementing a modern service worker architecture with reactive UI patterns.

### Core Technologies
- **Chrome Extension Manifest V3** - Service workers instead of background pages
- **Vanilla JavaScript** - No external frameworks in production build
- **Custom Reactive System** - Observable pattern inspired by Knockout.js
- **Material Design Lite** - Local CSS styling (no external CDNs)
- **Grunt Build System** - Task automation with Browserify bundling
- **ESLint** - Code quality with Google style guidelines

### Key File Structure
```
code/
├── manifest.json           # MV3 manifest with service worker
├── js/
│   ├── background-mv3.js   # Service worker (main orchestrator)
│   ├── sites-mv3.js        # Site detection & controller mapping
│   ├── popup/
│   │   └── popup-mv3.js    # Reactive popup UI system
│   ├── controllers/        # Site-specific media control handlers
│   └── modules/            # Shared utilities
├── html/
│   ├── popup-mv3.html      # Popup interface
│   └── options.html        # Settings page
└── css/                    # Material Design styling
```

## 🏗️ Architecture Patterns

### Service Worker Architecture (background-mv3.js)
- **Persistent State**: Uses `chrome.storage.local` for tab states and site settings
- **Message Router**: Handles communication between content scripts and popup
- **Command Processor**: Routes global media key commands to active tabs
- **Sites Interface**: Dynamically imports site detection logic

### Reactive UI System (popup-mv3.js)
The popup uses a custom Observable system to prevent UI flicker:

```javascript
// Core reactive classes
class Observable {
  // Single value with change listeners
}

class ComputedObservable extends Observable {
  // Derived values that auto-update when dependencies change
}

class MusicTab {
  // Reactive model for each music site tab
  constructor(data) {
    this.song = new Observable(data.song);
    this.playing = new Observable(data.isPlaying);
    this.canPlay = new Observable(data.canPlayPause);
    // ... other reactive properties
  }
}
```

### DOM Binding System
Instead of clearing and rebuilding DOM, elements are bound to observables:

```javascript
function bindText(element, observable) {
  element.textContent = observable.get();
  observable.subscribe(newValue => element.textContent = newValue);
}

function bindClass(element, observable, className) {
  observable.subscribe(value => element.classList.toggle(className, !!value));
}
```

## 🔧 Development Guidelines

### Code Style & Patterns

1. **Use Reactive Updates Only**
   ```javascript
   // ✅ Good - Reactive binding
   bindText(songElement, tab.song);
   
   // ❌ Bad - Manual DOM manipulation
   songElement.textContent = "New Song";
   ```

2. **Service Worker Compatibility**
   ```javascript
   // ✅ Good - Persistent storage
   chrome.storage.local.set({ tabStates: data });
   
   // ❌ Bad - In-memory variables (lost on restart)
   let tabStates = {};
   ```

3. **Async/Await for Chrome APIs**
   ```javascript
   // ✅ Good - Modern promise syntax
   const result = await chrome.tabs.query({ active: true });
   
   // ❌ Bad - Callback hell
   chrome.tabs.query({ active: true }, (tabs) => { ... });
   ```

### Build System Integration

The project uses Grunt for build automation:

```bash
# Development build with watch mode
npm run grunt:dev

# Production build
npm run grunt:dist

# Linting
npm run lint
```

**Key Grunt Tasks:**
- `browserify`: Bundles CommonJS modules for content scripts
- `sass`: Compiles SCSS to CSS
- `watch`: Auto-rebuilds on file changes
- `eslint`: Code quality checks

### File Editing Patterns

1. **Service Worker (background-mv3.js)**
   - Use `importScripts()` for external dependencies
   - Always handle storage errors gracefully
   - Implement message passing error handling

2. **Popup System (popup-mv3.js)**
   - Never use `innerHTML` clearing - use reactive updates
   - Create observables for all dynamic data
   - Bind DOM elements once, let observables handle updates

3. **Content Scripts (controllers/)**
   - Extend `BaseController` or `MouseEventController`
   - Use site-specific selectors for media elements
   - Handle dynamic content loading with mutation observers

## 🐛 Common Issues & Solutions

### MV3 Migration Issues

1. **Service Worker Restarts**
   ```javascript
   // ✅ Solution - Persistent storage
   async function loadTabStates() {
     const result = await chrome.storage.local.get(['tabStates']);
     return result.tabStates || {};
   }
   ```

2. **CSP Violations**
   ```javascript
   // ✅ Solution - Local scripts only
   // Remove external CDN references
   // Use bundled dependencies
   ```

3. **Background Page → Service Worker**
   ```javascript
   // ✅ Replace persistent background
   "background": {
     "service_worker": "js/background-mv3.js"
   }
   ```

### UI Flicker Prevention

The reactive system eliminates flicker by:
- Creating DOM elements once
- Using observables for all state changes
- Never clearing containers with `innerHTML = ""`
- Binding individual properties to specific elements

### Performance Optimization

1. **Lazy Loading**: Only create UI elements when needed
2. **Debounced Updates**: Batch rapid state changes
3. **Efficient Selectors**: Cache DOM queries
4. **Memory Management**: Unsubscribe from observables when elements are removed

## 🔍 Debugging & Testing

### Console Debugging
The codebase includes extensive debug logging marked with `#!#`:

```javascript
// #!# console.log("Debug info", data);
```

These can be enabled/disabled by uncommenting for development.

### Chrome Extension Tools
- **Service Worker Inspector**: `chrome://extensions` → Streamkeys → Service Worker
- **Popup DevTools**: Right-click popup → Inspect
- **Storage Inspector**: Application tab → Storage → Extensions

### Common Debug Points
1. **Message Passing**: Check background ↔ popup ↔ content script communication
2. **Storage State**: Verify persistent data survival across service worker restarts
3. **Observable Updates**: Ensure reactive bindings trigger properly
4. **Site Detection**: Verify controller loading for music sites

## 📝 Code Patterns & Examples

### Adding New Site Support

1. **Create Controller** (in `controllers/NewSiteController.js`):
   ```javascript
   const BaseController = require("BaseController");
   
   const controller = new BaseController({
     siteName: "New Music Site",
     playPause: ".play-button",
     playNext: ".next-button",
     playState: ".playing",
     song: ".song-title",
     artist: ".artist-name"
   });
   ```

2. **Register in sites-mv3.js**:
   ```javascript
   "newmusicsite.com": {
     name: "New Music Site",
     controller: "NewSiteController"
   }
   ```

### Adding Popup Features

1. **Add Observable Property**:
   ```javascript
   class MusicTab {
     constructor(data) {
       this.newFeature = new Observable(data.newFeature || false);
     }
   }
   ```

2. **Create UI Element**:
   ```javascript
   const newButton = document.createElement("button");
   bindClass(newButton, tab.newFeature, "active");
   bindText(newButton, new ComputedObservable(() => 
     tab.newFeature.get() ? "On" : "Off", [tab.newFeature]));
   ```

### Service Worker Message Handling

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    switch(request.action) {
      case "new_action":
        handleNewAction(request.data);
        sendResponse({ success: true });
        break;
      default:
        console.warn("Unknown action:", request.action);
        sendResponse({ error: "Unknown action" });
    }
  } catch (error) {
    console.error("Message handling error:", error);
    sendResponse({ error: error.message });
  }
});
```

## 🚀 Best Practices

### Performance
- Use `chrome.storage.local` for persistence (faster than sync)
- Implement lazy loading for popup UI
- Cache frequently accessed DOM elements
- Batch observable updates where possible

### Reliability
- Always handle `chrome.runtime.lastError` in callbacks
- Implement graceful degradation for missing site features
- Use try/catch blocks around Chrome API calls
- Validate data before storage operations

### Maintainability
- Follow existing Observable patterns for new features
- Use ESLint configuration for consistent style
- Add debug logging for complex operations
- Document site-specific controller quirks

### User Experience
- Maintain MV2-style visual appearance during MV3 migration
- Implement instant UI feedback with optimistic updates
- Provide clear error states and loading indicators
- Ensure accessibility with proper ARIA labels

## 🔗 Extension Points

### Custom Controllers
Extend `BaseController` for site-specific logic:

```javascript
const CustomController = function() {
  const controller = new BaseController(config);
  
  // Override specific methods
  controller.playPause = function() {
    // Custom play/pause logic
  };
  
  return controller;
};
```

### Storage Extensions
Add new persistent data types:

```javascript
async function saveCustomData(data) {
  await chrome.storage.local.set({ customKey: data });
}
```

### UI Components
Create reusable reactive components:

```javascript
function createToggleButton(observable, label) {
  const button = document.createElement("button");
  bindText(button, new ComputedObservable(() => 
    observable.get() ? `${label}: On` : `${label}: Off`, [observable]));
  button.onclick = () => observable.set(!observable.get());
  return button;
}
```

---

This documentation should be referenced when making changes to ensure consistency with the established MV3 architecture and reactive UI patterns. The codebase prioritizes performance, reliability, and maintainability while preserving the user experience from the original MV2 implementation.
