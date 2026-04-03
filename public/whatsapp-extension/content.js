// ══════════════════════════════════════════════
// WhatsApp Direct Send - Content Script Bridge
// Self-healing: re-injects when extension reloads
// ══════════════════════════════════════════════

(function () {
  // Allow re-injection after extension reload
  var HEARTBEAT_MS = 3000;
  var alive = false;

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
      direction: "from-extension-wa",
      action: data.action,
      requestId: data.requestId,
      response: { success: false, error: error },
    });
  }

  function relayMessage(data) {
    if (!isExtensionAlive()) {
      alive = false;
      failResponse(data, "Extension context invalidated — ricarica la pagina");
      post({ direction: "from-extension-wa", action: "extensionDead" });
      return;
    }

    try {
      var msg = { source: "wa-content-bridge", action: data.action };
      if (data.phone) msg.phone = data.phone;
      if (data.text) msg.text = data.text;
      if (data.contact) msg.contact = data.contact;
      if (data.maxMessages) msg.maxMessages = data.maxMessages;
      if (data.supabaseUrl) msg.supabaseUrl = data.supabaseUrl;
      if (data.anonKey) msg.anonKey = data.anonKey;
      if (data.authToken) msg.authToken = data.authToken;

      chrome.runtime.sendMessage(msg, function (response) {
        if (chrome.runtime.lastError) {
          alive = false;
          console.warn("[WA Content] Extension error:", chrome.runtime.lastError.message);
          failResponse(data, "Extension context invalidated — prova a ricaricare la pagina");
          post({ direction: "from-extension-wa", action: "extensionDead" });
          return;
        }

        alive = true;
        post({
          direction: "from-extension-wa",
          action: data.action,
          requestId: data.requestId,
          response: response || { success: false, error: "No response from extension" },
        });

        if (data.action === "ping") {
          post({ direction: "from-extension-wa", action: "contentScriptReady" });
        }
      });
    } catch (err) {
      alive = false;
      console.warn("[WA Content] sendMessage failed:", err.message);
      failResponse(data, "Extension context invalidated — prova a ricaricare la pagina");
      post({ direction: "from-extension-wa", action: "extensionDead" });
    }
  }

  // Heartbeat: detect extension reload and re-announce
  setInterval(function () {
    var nowAlive = isExtensionAlive();
    if (nowAlive && !alive) {
      alive = true;
      // Re-mark as active so new injection is accepted
      globalThis.__WA_EXTENSION_BRIDGE_ACTIVE__ = true;
      post({ direction: "from-extension-wa", action: "contentScriptReady" });
      console.info("[WA Content] Extension reconnected");
    } else if (!nowAlive && alive) {
      alive = false;
      // Clear the flag so a fresh injection can take over
      globalThis.__WA_EXTENSION_BRIDGE_ACTIVE__ = false;
      post({ direction: "from-extension-wa", action: "extensionDead" });
      console.warn("[WA Content] Extension context lost");
    }
  }, HEARTBEAT_MS);

  // Remove previous listener if re-injected
  if (globalThis.__WA_MSG_LISTENER__) {
    window.removeEventListener("message", globalThis.__WA_MSG_LISTENER__);
  }

  globalThis.__WA_MSG_LISTENER__ = function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.direction !== "from-webapp-wa") return;
    relayMessage(data);
  };

  window.addEventListener("message", globalThis.__WA_MSG_LISTENER__);
  globalThis.__WA_EXTENSION_BRIDGE_ACTIVE__ = true;

  // Initial check
  alive = isExtensionAlive();
  if (alive) {
    post({ direction: "from-extension-wa", action: "contentScriptReady" });
  }
})();
