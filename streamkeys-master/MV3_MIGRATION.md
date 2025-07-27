# Streamkeys Manifest V3 Migration

This document outlines the changes made to convert the Streamkeys Chrome extension from Manifest V2 to Manifest V3.

## Major Changes Made

### 1. Manifest File Updates (`manifest.json`)

**Changed:**
- `manifest_version`: Updated from `2` to `3`
- `browser_action` → `action`: Updated browser action API
- `background.scripts` → `background.service_worker`: Converted to service worker
- `permissions`: Split host permissions into separate `host_permissions` array
- `content_security_policy`: Updated format for MV3
- `web_accessible_resources`: Changed from array of strings to array of objects with `resources` and `matches` properties

**Added:**
- `name`, `version`, `description`: Required fields for MV3
- `scripting` permission for dynamic script injection
- `activeTab` permission for enhanced tab access

### 2. Background Script Migration

**Created new files:**
- `background-mv3.js`: New service worker replacing the browserify-based background script
- `sites-mv3.js`: Site list and URL matching logic extracted for service worker compatibility

**Key changes:**
- Removed `require()` statements (not supported in service workers)
- Used `importScripts()` for dependencies
- Replaced `chrome.tabs.executeScript()` with `chrome.scripting.executeScript()`
- Updated message handling for service worker environment

### 3. Popup UI Overhaul

**Approach:**
- Used the original popup HTML structure to maintain compatibility
- Updated popup to use `popup-mv3.js` (standalone script without browserify dependencies) 
- Kept the existing CSS styles and layout

**Key changes:**
- Replaced Knockout.js data-binding with direct DOM manipulation
- Removed dependencies on Lodash and Material Design Lite
- Simplified observable implementation for basic reactivity
- Updated Chrome API calls from MV2 to MV3 format

### 4. API Updates

**In `popup.js`:**
- `chrome.tabs.update({selected: true})` → `chrome.tabs.update({active: true})`
- `chrome.extension.getBackgroundPage()` → message passing to service worker

### 5. Permissions Updates

**Added to manifest:**
- `scripting`: Required for dynamic script injection in MV3
- `activeTab`: Enhanced tab access permissions

**Moved to `host_permissions`:**
- `http://*/*` and `https://*/*` moved from `permissions` to `host_permissions`

## Files Modified

1. **`code/manifest.json`** - Updated to Manifest V3 format
2. **`code/js/popup/popup.js`** - Updated deprecated APIs  
3. **`code/js/popup/popup-mv3.js`** - New standalone popup script (created)
4. **`code/html/popup-mv3.html`** - Simplified popup HTML (created)
5. **`code/css/popup.css`** - Basic CSS styles (created)
6. **`code/js/background-mv3.js`** - New service worker (created)
7. **`code/js/sites-mv3.js`** - Site list for MV3 (created)

## Testing the Migration

1. Load the extension in Chrome Developer Mode
2. Test keyboard shortcuts with supported music sites
3. Verify popup functionality
4. Check background script console for errors

## Known Limitations

1. The service worker implementation is simplified compared to the original browserify build
2. Some advanced features may need additional testing
3. Site detection logic has been extracted but should be verified against the original

## Known Issues

### Non-Passive Event Listener Warnings

The extension may show console warnings about "non-passive event listeners" from various music sites (not from the extension itself). These warnings are from the websites' own JavaScript and don't affect the extension's functionality. Examples:

```
[Violation] Added non-passive event listener to a scroll-blocking event. 
Consider marking event handler as 'passive' to make the page more responsive.
```

These warnings come from the music sites themselves and are not related to the Streamkeys extension. They can be safely ignored as they don't impact the extension's media control functionality.

### Controller Injection Issues

If you see "require is not defined" errors, it means the extension is trying to inject old MV2 controllers instead of MV3-compatible ones. Make sure:

1. The `sites-mv3.js` file references the correct controller files (e.g., `YoutubeController-mv3.js` instead of `YoutubeController.js`)
2. The auto-injection system in `background-mv3.js` is working correctly
3. The extension has been reloaded after any changes

**Important: Build Process**
This project uses a build script (`build-mv3.js`) that copies files from the `code/` directory to `build/mv3/`. Any manual changes made directly in `build/mv3/` will be overwritten when the build script runs. Always make changes in the source `code/` directory and then run:

```bash
node build-mv3.js
```

**Troubleshooting Steps:**
1. Check the browser console for errors like "YoutubeController.js:3 Uncaught ReferenceError: require is not defined"
2. If you see this error, verify that `code/js/sites-mv3.js` has `"YoutubeController-mv3.js"` for the YouTube entry
3. Run `node build-mv3.js` to rebuild the extension
4. Reload the extension at `chrome://extensions/`
5. Clear browser cache and reload the YouTube page
6. Check the service worker console for injection messages like "🎵 Injecting controller for YouTube: YoutubeController-mv3.js"

**Expected Service Worker Console Output:**
```
Checking URL: https://www.youtube.com/watch?v=...
Testing youtube (www.youtube.com) against https://www.youtube.com/watch?v=...
✅ Match found: youtube
🎵 Injecting controller for YouTube: YoutubeController-mv3.js
✅ Successfully injected YoutubeController-mv3.js for YouTube
```

## Next Steps

1. Test all supported music sites
2. Verify all keyboard shortcuts work correctly
3. Update build process to work with MV3 service worker
4. Consider updating to use ES modules instead of importScripts

## Compatibility

This updated extension should work with:
- Chrome 88+
- Edge 88+ (Chromium-based)
- Other Chromium-based browsers supporting Manifest V3
