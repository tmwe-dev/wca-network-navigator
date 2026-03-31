// ══════════════════════════════════════════════
// LinkedIn Cookie Sync - Content Script Bridge
// Auto-reconnects when extension context is invalidated
// ══════════════════════════════════════════════

(function () {
  var RETRY_INTERVAL = 2000;
  var MAX_RETRIES = 5;

  function isExtensionAlive() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function postToPage(payload) {
    try {
      window.postMessage(payload, window.location.origin);
    } catch (_) {
      window.postMessage(payload, "*");
    }
  }

  function relayMessage(data) {
    if (!isExtensionAlive()) {
      postToPage({
        direction: "from-extension-li",
        action: data.action,
        requestId: data.requestId,
        response: { success: false, error: "Extension context invalidated — ricarica la pagina" },
      });
      return;
    }

    try {
      var msg = { source: "li-content-bridge", action: data.action };
      if (data.url) msg.url = data.url;
      if (data.message) msg.message = data.message;

      chrome.runtime.sendMessage(msg, function (response) {
        if (chrome.runtime.lastError) {
          console.warn("[LI Content] Extension error:", chrome.runtime.lastError.message);
          postToPage({
            direction: "from-extension-li",
            action: data.action,
            requestId: data.requestId,
            response: { success: false, error: "Extension context invalidated" },
          });
          return;
        }

        postToPage({
          direction: "from-extension-li",
          action: data.action,
          requestId: data.requestId,
          response: response || { success: false, error: "No response from extension" },
        });

        if (data.action === "ping") {
          postToPage({ direction: "from-extension-li", action: "contentScriptReady" });
        }
      });
    } catch (err) {
      console.warn("[LI Content] sendMessage failed:", err.message);
      postToPage({
        direction: "from-extension-li",
        action: data.action,
        requestId: data.requestId,
        response: { success: false, error: "Extension context invalidated" },
      });
    }
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.direction !== "from-webapp-li") return;
    relayMessage(data);
  });

  postToPage({ direction: "from-extension-li", action: "contentScriptReady" });
})();
