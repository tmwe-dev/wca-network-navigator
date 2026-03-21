// ══════════════════════════════════════════════════
// WCA Content Script Bridge V3
// Relays messages between webapp and background
// Uses origin-scoped postMessage for security
// ══════════════════════════════════════════════════

(function () {
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;

  var appOrigin = window.location.origin;

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.direction !== "from-webapp") return;

    var msg = { source: "wca-content-bridge" };
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] !== "direction") msg[keys[i]] = data[keys[i]];
    }

    try {
      chrome.runtime.sendMessage(msg, function (response) {
        if (chrome.runtime.lastError) {
          window.postMessage({
            direction: "from-extension", action: data.action, requestId: data.requestId,
            response: { success: false, error: "Extension context invalidated" }
          }, appOrigin);
          return;
        }
        window.postMessage({
          direction: "from-extension", action: data.action, requestId: data.requestId,
          response: response || { success: false, error: "No response from extension" }
        }, appOrigin);
      });
    } catch (err) {
      window.postMessage({
        direction: "from-extension", action: data.action, requestId: data.requestId,
        response: { success: false, error: "Extension context invalidated" }
      }, appOrigin);
    }
  });

  // Announce content script loaded
  window.postMessage({ direction: "from-extension", action: "contentScriptReady" }, appOrigin);
})();
