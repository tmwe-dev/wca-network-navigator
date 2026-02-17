// ══════════════════════════════════════════════════
// WCA Cookie Sync - Content Script Bridge
// Injected into the webapp pages to relay messages
// between window.postMessage (webapp) and chrome.runtime (background)
// ══════════════════════════════════════════════════

(function () {
  // Guard: if extension context is already dead, bail out silently
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;

    var data = event.data;
    if (!data || data.direction !== "from-webapp") return;

    try {
      chrome.runtime.sendMessage(
        { source: "wca-content-bridge", action: data.action, wcaId: data.wcaId },
        function (response) {
          // Check for invalidated context inside callback too
          if (chrome.runtime.lastError) {
            console.warn("[WCA Content] Extension context lost:", chrome.runtime.lastError.message);
            window.postMessage(
              {
                direction: "from-extension",
                action: data.action,
                requestId: data.requestId,
                response: { success: false, error: "Extension context invalidated" },
              },
              "*"
            );
            return;
          }

          window.postMessage(
            {
              direction: "from-extension",
              action: data.action,
              requestId: data.requestId,
              response: response || { success: false, error: "No response from extension" },
            },
            "*"
          );

          if (data.action === "ping") {
            window.postMessage(
              { direction: "from-extension", action: "contentScriptReady" },
              "*"
            );
          }
        }
      );
    } catch (err) {
      // Extension was unloaded/reloaded — fail gracefully
      console.warn("[WCA Content] sendMessage failed (context invalidated):", err.message);
      window.postMessage(
        {
          direction: "from-extension",
          action: data.action,
          requestId: data.requestId,
          response: { success: false, error: "Extension context invalidated" },
        },
        "*"
      );
    }
  });

  // Announce that the content script is loaded
  window.postMessage(
    { direction: "from-extension", action: "contentScriptReady" },
    "*"
  );
})();
