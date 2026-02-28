// ══════════════════════════════════════════════
// LinkedIn Cookie Sync - Content Script Bridge
// Injected into the webapp pages to relay messages
// ══════════════════════════════════════════════

(function () {
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.direction !== "from-webapp-li") return;

    try {
      var msg = { source: "li-content-bridge", action: data.action };
      if (data.url) msg.url = data.url;
      if (data.message) msg.message = data.message;

      chrome.runtime.sendMessage(msg, function (response) {
        if (chrome.runtime.lastError) {
          console.warn("[LI Content] Extension context lost:", chrome.runtime.lastError.message);
          window.postMessage({
            direction: "from-extension-li",
            action: data.action,
            requestId: data.requestId,
            response: { success: false, error: "Extension context invalidated" },
          }, "*");
          return;
        }

        window.postMessage({
          direction: "from-extension-li",
          action: data.action,
          requestId: data.requestId,
          response: response || { success: false, error: "No response from extension" },
        }, "*");

        if (data.action === "ping") {
          window.postMessage(
            { direction: "from-extension-li", action: "contentScriptReady" },
            "*"
          );
        }
      });
    } catch (err) {
      console.warn("[LI Content] sendMessage failed:", err.message);
      window.postMessage({
        direction: "from-extension-li",
        action: data.action,
        requestId: data.requestId,
        response: { success: false, error: "Extension context invalidated" },
      }, "*");
    }
  });

  window.postMessage(
    { direction: "from-extension-li", action: "contentScriptReady" },
    "*"
  );
})();
