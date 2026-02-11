// ══════════════════════════════════════════════════
// WCA Cookie Sync - Content Script Bridge
// Injected into the webapp pages to relay messages
// between window.postMessage (webapp) and chrome.runtime (background)
// ══════════════════════════════════════════════════

(function () {
  // Listen for messages from the webapp
  window.addEventListener("message", function (event) {
    // Only accept messages from the same window
    if (event.source !== window) return;

    var data = event.data;
    if (!data || data.direction !== "from-webapp") return;

    // Forward to background service worker
    chrome.runtime.sendMessage(
      { source: "wca-content-bridge", action: data.action, wcaId: data.wcaId },
      function (response) {
        // Send response back to webapp
        window.postMessage(
          {
            direction: "from-extension",
            action: data.action,
            requestId: data.requestId,
            response: response || { success: false, error: "No response from extension" },
          },
          "*"
        );
      }
    );
  });

  // Announce that the content script is loaded
  window.postMessage(
    { direction: "from-extension", action: "contentScriptReady" },
    "*"
  );
})();
