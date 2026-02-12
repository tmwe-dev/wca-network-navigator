// ══════════════════════════════════════════════
// ReportAziende Cookie Sync - Content Script Bridge
// Injected into the webapp pages to relay messages
// ══════════════════════════════════════════════

(function () {
  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.direction !== "from-webapp-ra") return;

    chrome.runtime.sendMessage(
      { source: "ra-content-bridge", action: data.action },
      function (response) {
        window.postMessage(
          {
            direction: "from-extension-ra",
            action: data.action,
            requestId: data.requestId,
            response: response || { success: false, error: "No response from extension" },
          },
          "*"
        );

        if (data.action === "ping") {
          window.postMessage(
            { direction: "from-extension-ra", action: "contentScriptReady" },
            "*"
          );
        }
      }
    );
  });

  window.postMessage(
    { direction: "from-extension-ra", action: "contentScriptReady" },
    "*"
  );
})();
