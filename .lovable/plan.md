

# Fix: "Tabs cannot be edited right now" Error in LinkedIn Extension

## Problem

Chrome throws `"Tabs cannot be edited right now (user may be dragging a tab)"` when calling `chrome.tabs.create()` while the user is interacting with browser tabs (dragging, closing, etc.). The queue we added serializes operations but doesn't retry on this transient Chrome error.

## Root Cause

Every LinkedIn operation (`verifySession`, `searchProfile`, `extractProfile`, `sendMessage`, `sendConnectionRequest`, `autoLogin`) calls `chrome.tabs.create()` directly. If Chrome's tab system is temporarily locked, the call throws immediately and the whole operation fails.

## Solution

Add a **retry wrapper** around `chrome.tabs.create` and `chrome.tabs.remove` in `background.js` that catches this specific error and retries after a short delay (up to 3 attempts, 500ms apart).

### File: `public/linkedin-extension/background.js`

**Add helper function** (near top, after `waitForTabLoad`):

```js
async function safeTabCreate(options, maxRetries) {
  maxRetries = maxRetries || 3;
  for (var attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await chrome.tabs.create(options);
    } catch (err) {
      if (attempt < maxRetries - 1 && /cannot be edited/i.test(err.message)) {
        await new Promise(function(r) { setTimeout(r, 500); });
      } else {
        throw err;
      }
    }
  }
}

async function safeTabRemove(tabId) {
  try { await chrome.tabs.remove(tabId); } catch (e) {}
}
```

**Replace all occurrences** of:
- `chrome.tabs.create({...})` → `safeTabCreate({...})`
- `try { chrome.tabs.remove(tab.id); } catch (e) {}` → `safeTabRemove(tab.id)`

This affects ~15 `chrome.tabs.create` calls and ~20 `chrome.tabs.remove` calls across these functions:
- `verifyLinkedInSession`
- `autoLoginLinkedIn`
- `sendLinkedInMessage`
- `sendConnectionRequest`
- `extractProfileByUrl`
- `searchLinkedInProfile`

### Result
- Transient Chrome tab-lock errors get retried automatically (up to 3x)
- No more unhandled promise rejections from tab operations
- All existing queue serialization remains intact

