// ══════════════════════════════════════════════════
// WCA Content Script Bridge V4
// Relays messages between webapp and background
// Uses origin-scoped postMessage for security
// Periodic heartbeat for reliability
// ══════════════════════════════════════════════════

(function () {
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;

  const appOrigin = window.location.origin;

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.direction !== "from-webapp") return;

    // Handle ping locally for fastest response
    if (data.action === "ping") {
      window.postMessage({
        direction: "from-extension", action: "ping", requestId: data.requestId,
        response: { success: true, version: "content-bridge-v4" }
      }, appOrigin);
      return;
    }

    const msg = { source: "wca-content-bridge" };
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] !== "direction") msg[keys[i]] = data[keys[i]];
    }

    try {
      chrome.runtime.sendMessage(msg, function (response) {
        if (chrome.runtime.lastError) {
          window.postMessage({
            direction: "from-extension", action: data.action, requestId: data.requestId,
            response: { success: false, state: "bridge_error", errorCode: "EXT_CONTEXT_INVALIDATED", error: "Extension context invalidated" }
          }, appOrigin);
          return;
        }
        window.postMessage({
          direction: "from-extension", action: data.action, requestId: data.requestId,
          response: response || { success: false, state: "bridge_error", errorCode: "EXT_NO_RESPONSE", error: "No response from extension" }
        }, appOrigin);
      });
    } catch (err) {
      window.postMessage({
        direction: "from-extension", action: data.action, requestId: data.requestId,
        response: { success: false, state: "bridge_error", errorCode: "EXT_CONTEXT_INVALIDATED", error: "Extension context invalidated" }
      }, appOrigin);
    }
  });

  // Announce content script loaded
  window.postMessage({ direction: "from-extension", action: "contentScriptReady" }, appOrigin);

  // Periodic heartbeat every 10 seconds so the webapp knows we're alive
  setInterval(function () {
    try {
      // Verify extension context is still valid before announcing
      if (chrome.runtime && chrome.runtime.id) {
        window.postMessage({ direction: "from-extension", action: "contentScriptReady" }, appOrigin);
      }
    } catch (e) {
      // Extension context invalidated, stop heartbeat
    }
  }, 10000);
})();
