// ══════════════════════════════════════════════
// FireScrape – Content Script Bridge
// Same pattern as LinkedIn/WhatsApp extensions
// ══════════════════════════════════════════════

(function () {
  var HEARTBEAT_MS = 4000;
  var alive = true;

  function isExtensionAlive() {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) return false;
      void chrome.runtime.getManifest();
      return true;
    } catch (e) {
      return false;
    }
  }

  function post(payload) {
    try { window.postMessage(payload, window.location.origin); }
    catch (_) { window.postMessage(payload, "*"); }
  }

  function failResponse(data, error) {
    post({
      direction: "from-extension-fs",
      action: data.action,
      requestId: data.requestId,
      response: { success: false, error: error },
    });
  }

  function relayMessage(data) {
    if (!isExtensionAlive()) {
      alive = false;
      failResponse(data, "Extension context invalidated — ricarica la pagina");
      post({ direction: "from-extension-fs", action: "extensionDead" });
      return;
    }

    try {
      var msg = { source: "fs-content-bridge", action: data.action };
      if (data.query) msg.query = data.query;
      if (data.url) msg.url = data.url;
      if (data.limit) msg.limit = data.limit;

      chrome.runtime.sendMessage(msg, function (response) {
        if (chrome.runtime.lastError) {
          alive = false;
          console.warn("[FireScrape Content] Extension error:", chrome.runtime.lastError.message);
          failResponse(data, "Extension context invalidated");
          post({ direction: "from-extension-fs", action: "extensionDead" });
          return;
        }

        alive = true;
        post({
          direction: "from-extension-fs",
          action: data.action,
          requestId: data.requestId,
          response: response || { success: false, error: "No response from extension" },
        });

        if (data.action === "ping") {
          post({ direction: "from-extension-fs", action: "contentScriptReady" });
        }
      });
    } catch (err) {
      alive = false;
      console.warn("[FireScrape Content] sendMessage failed:", err.message);
      failResponse(data, "Extension context invalidated");
      post({ direction: "from-extension-fs", action: "extensionDead" });
    }
  }

  // Heartbeat
  setInterval(function () {
    var nowAlive = isExtensionAlive();
    if (nowAlive && !alive) {
      alive = true;
      post({ direction: "from-extension-fs", action: "contentScriptReady" });
      console.info("[FireScrape Content] Extension reconnected");
    } else if (!nowAlive && alive) {
      alive = false;
      post({ direction: "from-extension-fs", action: "extensionDead" });
      console.warn("[FireScrape Content] Extension context lost");
    }
  }, HEARTBEAT_MS);

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.direction !== "from-webapp-fs") return;
    relayMessage(data);
  });

  post({ direction: "from-extension-fs", action: "contentScriptReady" });
})();
