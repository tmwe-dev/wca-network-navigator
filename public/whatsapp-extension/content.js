// ══════════════════════════════════════════════
// WhatsApp Direct Send - Content Script Bridge
// Injected into the webapp pages to relay messages
// ══════════════════════════════════════════════

(function () {
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.direction !== "from-webapp-wa") return;

    try {
      var msg = { source: "wa-content-bridge", action: data.action };
      if (data.phone) msg.phone = data.phone;
      if (data.text) msg.text = data.text;

      chrome.runtime.sendMessage(msg, function (response) {
        if (chrome.runtime.lastError) {
          console.warn("[WA Content] Extension context lost:", chrome.runtime.lastError.message);
          window.postMessage({
            direction: "from-extension-wa",
            action: data.action,
            requestId: data.requestId,
            response: { success: false, error: "Extension context invalidated" },
          }, "*");
          return;
        }

        window.postMessage({
          direction: "from-extension-wa",
          action: data.action,
          requestId: data.requestId,
          response: response || { success: false, error: "No response from extension" },
        }, "*");

        if (data.action === "ping") {
          window.postMessage(
            { direction: "from-extension-wa", action: "contentScriptReady" },
            "*"
          );
        }
      });
    } catch (err) {
      console.warn("[WA Content] sendMessage failed:", err.message);
      window.postMessage({
        direction: "from-extension-wa",
        action: data.action,
        requestId: data.requestId,
        response: { success: false, error: "Extension context invalidated" },
      }, "*");
    }
  });

  window.postMessage(
    { direction: "from-extension-wa", action: "contentScriptReady" },
    "*"
  );
})();
