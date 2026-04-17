// ══════════════════════════════════════════════
// WhatsApp Extension v5.0 — Content Script Bridge
// Hardened: payload validation, action whitelist,
// adaptive heartbeat with exponential backoff,
// structured error codes
// ══════════════════════════════════════════════

(function () {
  const BASE_HEARTBEAT_MS = 8000;
  const MAX_HEARTBEAT_MS = 30000;
  let currentHeartbeat = BASE_HEARTBEAT_MS;
  let alive = false;
  let heartbeatTimer = null;

  // ── Allowed actions whitelist ──
  const ALLOWED_ACTIONS = [
    "ping", "setConfig", "verifySession", "sendWhatsApp",
    "readUnread", "learnDom", "diagnosticDom", "readThread",
    "backfillChat",
  ];

  const MAX_STRING_LENGTH = 5000;

  function isExtensionAlive() {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) return false;
      void chrome.runtime.getManifest();
      return true;
    } catch (_) { return false; }
  }

  function post(payload) {
    try { window.postMessage(payload, window.location.origin); }
    catch (_) { window.postMessage(payload, "*"); }
  }

  function failResponse(data, error, errorCode) {
    post({
      direction: "from-extension-wa",
      action: data.action,
      requestId: data.requestId,
      response: { success: false, error: error, errorCode: errorCode || "ERR_BRIDGE" },
    });
  }

  // ── Payload validation ──
  function validatePayload(data) {
    if (!data || typeof data !== "object") return "Invalid payload";
    if (!data.action || typeof data.action !== "string") return "Missing action";
    if (ALLOWED_ACTIONS.indexOf(data.action) === -1) return "Unknown action: " + data.action;
    const stringFields = ["phone", "text", "contact", "lastKnownText", "supabaseUrl", "anonKey", "authToken"];
    for (let i = 0; i < stringFields.length; i++) {
      const field = stringFields[i];
      if (data[field] && typeof data[field] === "string" && data[field].length > MAX_STRING_LENGTH) {
        return "Field " + field + " exceeds max length";
      }
    }
    return null;
  }

  function relayMessage(data) {
    const validationError = validatePayload(data);
    if (validationError) {
      failResponse(data, validationError, "ERR_VALIDATION");
      return;
    }

    if (!isExtensionAlive()) {
      alive = false;
      currentHeartbeat = BASE_HEARTBEAT_MS;
      failResponse(data, "Extension context invalidated — ricarica la pagina", "ERR_CONTEXT_DEAD");
      post({ direction: "from-extension-wa", action: "extensionDead" });
      return;
    }

    try {
      const msg = { source: "wa-content-bridge", action: data.action };
      if (data.phone) msg.phone = data.phone;
      if (data.text) msg.text = data.text;
      if (data.contact) msg.contact = data.contact;
      if (data.maxMessages) msg.maxMessages = data.maxMessages;
      if (data.maxScrolls) msg.maxScrolls = data.maxScrolls;
      if (data.lastKnownText) msg.lastKnownText = data.lastKnownText;
      if (data.supabaseUrl) msg.supabaseUrl = data.supabaseUrl;
      if (data.anonKey) msg.anonKey = data.anonKey;
      if (data.authToken) msg.authToken = data.authToken;

      chrome.runtime.sendMessage(msg, function (response) {
        if (chrome.runtime.lastError) {
          alive = false;
          currentHeartbeat = BASE_HEARTBEAT_MS;
          failResponse(data, "Extension context invalidated", "ERR_RUNTIME");
          post({ direction: "from-extension-wa", action: "extensionDead" });
          return;
        }

        alive = true;
        currentHeartbeat = Math.min(currentHeartbeat * 1.5, MAX_HEARTBEAT_MS);

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
      currentHeartbeat = BASE_HEARTBEAT_MS;
      failResponse(data, "Extension context invalidated", "ERR_SEND_FAILED");
      post({ direction: "from-extension-wa", action: "extensionDead" });
    }
  }

  // ── Adaptive heartbeat with exponential backoff ──
  function scheduleHeartbeat() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(function () {
      const nowAlive = isExtensionAlive();
      if (nowAlive && !alive) {
        alive = true;
        currentHeartbeat = BASE_HEARTBEAT_MS;
        post({ direction: "from-extension-wa", action: "contentScriptReady" });
      } else if (!nowAlive && alive) {
        alive = false;
        currentHeartbeat = BASE_HEARTBEAT_MS;
        post({ direction: "from-extension-wa", action: "extensionDead" });
      } else if (nowAlive) {
        currentHeartbeat = Math.min(currentHeartbeat * 1.2, MAX_HEARTBEAT_MS);
      }
      scheduleHeartbeat();
    }, currentHeartbeat);
  }

  // ── Remove previous listener if re-injected ──
  if (globalThis.__WA_MSG_LISTENER__) {
    window.removeEventListener("message", globalThis.__WA_MSG_LISTENER__);
  }

  globalThis.__WA_MSG_LISTENER__ = function (event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data) return;

    // Optimus response from webapp → forward to background as runtime message
    if (data.direction === "from-webapp-optimus-response") {
      if (!isExtensionAlive()) return;
      try {
        chrome.runtime.sendMessage({
          source: "wca-optimus-response",
          requestId: data.requestId,
          payload: data.payload,
        });
      } catch (_) { /* extension dead */ }
      return;
    }

    if (data.direction !== "from-webapp-wa") return;
    relayMessage(data);
  };

  window.addEventListener("message", globalThis.__WA_MSG_LISTENER__);
  globalThis.__WA_EXTENSION_BRIDGE_ACTIVE__ = true;

  post({ direction: "from-extension-wa", action: "contentScriptReady" });
  scheduleHeartbeat();
})();
