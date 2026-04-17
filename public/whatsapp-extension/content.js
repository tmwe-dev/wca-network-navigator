// ==================================================
// WhatsApp Extension v5.4 — Content Script Bridge
// Hardened: reinject cleanup, AI bridge relay,
// payload validation, adaptive heartbeat
// ==================================================

(function () {
  // ── Cleanup from previous injection ──
  if (globalThis.__WA_MSG_LISTENER__) {
    window.removeEventListener("message", globalThis.__WA_MSG_LISTENER__);
  }
  if (globalThis.__WA_HEARTBEAT_TIMER__) {
    clearTimeout(globalThis.__WA_HEARTBEAT_TIMER__);
    globalThis.__WA_HEARTBEAT_TIMER__ = null;
  }
  if (globalThis.__WA_AI_BRIDGE_LISTENER__) {
    chrome.runtime.onMessage.removeListener(globalThis.__WA_AI_BRIDGE_LISTENER__);
  }

  var BASE_HEARTBEAT_MS = 8000;
  var MAX_HEARTBEAT_MS = 30000;
  var currentHeartbeat = BASE_HEARTBEAT_MS;
  var alive = false;

  var ALLOWED_ACTIONS = [
    "ping", "setConfig", "verifySession", "sendWhatsApp",
    "readUnread", "learnDom", "diagnosticDom", "readThread",
    "backfillChat",
  ];

  var MAX_STRING_LENGTH = 5000;

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

  function validatePayload(data) {
    if (!data || typeof data !== "object") return "Invalid payload";
    if (!data.action || typeof data.action !== "string") return "Missing action";
    if (ALLOWED_ACTIONS.indexOf(data.action) === -1) return "Unknown action: " + data.action;
    var stringFields = ["phone", "text", "contact", "lastKnownText", "supabaseUrl", "anonKey", "authToken"];
    for (var i = 0; i < stringFields.length; i++) {
      var field = stringFields[i];
      if (data[field] && typeof data[field] === "string" && data[field].length > MAX_STRING_LENGTH) {
        return "Field " + field + " exceeds max length";
      }
    }
    return null;
  }

  function relayMessage(data) {
    var validationError = validatePayload(data);
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
      var msg = { source: "wa-content-bridge", action: data.action };
      var fields = ["phone", "text", "contact", "maxMessages", "maxScrolls", "lastKnownText", "supabaseUrl", "anonKey", "authToken"];
      for (var i = 0; i < fields.length; i++) {
        if (data[fields[i]] !== undefined) msg[fields[i]] = data[fields[i]];
      }

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

  // ── AI Bridge relay: background → webapp → background ──
  // Background sends ai-bridge-request to this content script,
  // we relay it to the webapp page via postMessage,
  // and relay the response back to background.
  globalThis.__WA_AI_BRIDGE_LISTENER__ = function (message, sender, sendResponse) {
    if (!message || message.source !== "wa-background-bridge" || message.type !== "ai-bridge-request") {
      return false;
    }

    var requestId = message.requestId;

    // Listen for the webapp's response (one-shot)
    function onWebappResponse(event) {
      if (event.source !== window) return;
      var d = event.data;
      if (!d || d.direction !== "from-webapp-ai-bridge-response" || d.requestId !== requestId) return;
      window.removeEventListener("message", onWebappResponse);
      // Relay back to background
      try {
        chrome.runtime.sendMessage({
          source: "wa-content-bridge",
          type: "ai-bridge-response",
          requestId: requestId,
          data: d.result || null,
        });
      } catch (_) {}
    }
    window.addEventListener("message", onWebappResponse);

    // Set a timeout to clean up
    setTimeout(function () {
      window.removeEventListener("message", onWebappResponse);
    }, 35000);

    // Forward request to webapp
    post({
      direction: "from-extension-ai-bridge-request",
      requestId: requestId,
      functionName: message.functionName,
      payload: message.payload,
    });

    return false; // async response handled via separate message
  };
  chrome.runtime.onMessage.addListener(globalThis.__WA_AI_BRIDGE_LISTENER__);

  // ── Adaptive heartbeat ──
  function scheduleHeartbeat() {
    globalThis.__WA_HEARTBEAT_TIMER__ = setTimeout(function () {
      globalThis.__WA_HEARTBEAT_TIMER__ = null;
      var nowAlive = isExtensionAlive();
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

  // ── Message listener from webapp ──
  globalThis.__WA_MSG_LISTENER__ = function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.direction !== "from-webapp-wa") return;
    relayMessage(data);
  };

  window.addEventListener("message", globalThis.__WA_MSG_LISTENER__);
  globalThis.__WA_EXTENSION_BRIDGE_ACTIVE__ = true;

  post({ direction: "from-extension-wa", action: "contentScriptReady" });
  scheduleHeartbeat();
})();
