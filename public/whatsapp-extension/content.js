// ══════════════════════════════════════════════
// WhatsApp Direct Send - Content Script Bridge
// Self-healing: reconnects when service worker restarts
// ══════════════════════════════════════════════

(function () {
  var HEARTBEAT_MS = 2500;
  var alive = false;
  var reconnectAttempts = 0;

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

  // Wake up service worker by sending a ping
  function wakeServiceWorker() {
    try {
      chrome.runtime.sendMessage({ source: "wa-content-bridge", action: "ping" }, function(resp) {
        if (chrome.runtime.lastError) {
          alive = false;
          return;
        }
        if (resp && resp.success) {
          alive = true;
          reconnectAttempts = 0;
          post({ direction: "from-extension-wa", action: "contentScriptReady" });
        }
      });
    } catch (_) {
      alive = false;
    }
  }

  function relayMessage(data) {
    if (!isExtensionAlive()) {
      alive = false;
      // Try to wake the service worker instead of immediately failing
      reconnectAttempts++;
      if (reconnectAttempts <= 3) {
        wakeServiceWorker();
        // Retry relay after a short delay
        setTimeout(function() {
          if (alive) relayMessage(data);
          else failResponse(data, "Extension context invalidated — ricarica la pagina");
        }, 1000);
        return;
      }
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
          // Don't immediately fail - try to wake the worker
          wakeServiceWorker();
          setTimeout(function() {
            if (alive) {
              // Retry the relay
              chrome.runtime.sendMessage(msg, function(retryResp) {
                if (chrome.runtime.lastError) {
                  failResponse(data, "Extension non raggiungibile dopo retry");
                  return;
                }
                post({
                  direction: "from-extension-wa",
                  action: data.action,
                  requestId: data.requestId,
                  response: retryResp || { success: false, error: "No response" },
                });
              });
            } else {
              failResponse(data, "Extension context invalidated — ricarica la pagina");
              post({ direction: "from-extension-wa", action: "extensionDead" });
            }
          }, 1500);
          return;
        }

        alive = true;
        reconnectAttempts = 0;
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

  // Heartbeat: proactively wake service worker
  setInterval(function () {
    var nowAlive = isExtensionAlive();
    if (nowAlive) {
      // Proactively wake the service worker to keep it alive
      wakeServiceWorker();
    } else if (alive) {
      alive = false;
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

  // Initial check + wake
  alive = isExtensionAlive();
  if (alive) {
    wakeServiceWorker();
  }
})();
