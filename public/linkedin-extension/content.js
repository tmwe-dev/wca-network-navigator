// ══════════════════════════════════════════════
// LinkedIn Cookie Sync - Content Script Bridge
// Auto-reconnects when extension context is invalidated
// ══════════════════════════════════════════════

(function () {
  var HEARTBEAT_MS = 4000;
  var alive = true;

  function isExtensionAlive() {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) return false;
      // Trigger getter — throws if context is dead
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
      direction: "from-extension-li",
      action: data.action,
      requestId: data.requestId,
      response: { success: false, error: error },
    });
  }

  function relayMessage(data) {
    if (!isExtensionAlive()) {
      alive = false;
      failResponse(data, "Extension context invalidated — ricarica la pagina");
      post({ direction: "from-extension-li", action: "extensionDead" });
      return;
    }

    try {
      var msg = { source: "li-content-bridge", action: data.action };
      if (data.url) msg.url = data.url;
      if (data.message) msg.message = data.message;

      chrome.runtime.sendMessage(msg, function (response) {
        if (chrome.runtime.lastError) {
          alive = false;
          console.warn("[LI Content] Extension error:", chrome.runtime.lastError.message);
          failResponse(data, "Extension context invalidated");
          post({ direction: "from-extension-li", action: "extensionDead" });
          return;
        }

        alive = true;
        post({
          direction: "from-extension-li",
          action: data.action,
          requestId: data.requestId,
          response: response || { success: false, error: "No response from extension" },
        });

        if (data.action === "ping") {
          post({ direction: "from-extension-li", action: "contentScriptReady" });
        }
      });
    } catch (err) {
      alive = false;
      console.warn("[LI Content] sendMessage failed:", err.message);
      failResponse(data, "Extension context invalidated");
      post({ direction: "from-extension-li", action: "extensionDead" });
    }
  }

  // Heartbeat: periodically check if extension is still alive and re-announce
  setInterval(function () {
    var nowAlive = isExtensionAlive();
    if (nowAlive && !alive) {
      // Extension came back (e.g. reloaded) — re-announce
      alive = true;
      post({ direction: "from-extension-li", action: "contentScriptReady" });
      console.info("[LI Content] Extension reconnected");
    } else if (!nowAlive && alive) {
      alive = false;
      post({ direction: "from-extension-li", action: "extensionDead" });
      console.warn("[LI Content] Extension context lost");
    }
  }, HEARTBEAT_MS);

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.direction !== "from-webapp-li") return;
    relayMessage(data);
  });

  post({ direction: "from-extension-li", action: "contentScriptReady" });
})();
