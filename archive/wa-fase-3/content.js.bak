// ==================================================
// WhatsApp Extension v5.4.1 — Content Script Bridge
// Hardened: reinject cleanup, AI bridge relay,
// Optimus relay, payload validation, origin check,
// adaptive heartbeat
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

  // ── Origin check helper: only accept messages from our app domains ──
  function isAllowedOrigin(origin) {
    if (!origin) return false;
    return !!(
      origin.match(/\.lovable\.app$/i) ||
      origin.match(/\.lovableproject\.com$/i) ||
      origin.match(/^https?:\/\/localhost(:\d+)?$/i) ||
      origin.match(/^https?:\/\/127\.0\.0\.1(:\d+)?$/i)
    );
  }

  function isExtensionAlive() {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) return false;
      void chrome.runtime.getManifest();
      return true;
    } catch (err) { console.debug("[WA Content] extension dead:", err?.message); return false; }
  }

  function post(payload) {
    try { window.postMessage(payload, window.location.origin); }
    catch (err) { console.debug("[WA Content] origin post failed, using *:", err?.message); window.postMessage(payload, "*"); }
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

  // ── AI Bridge + Optimus relay: background → webapp → background ──
  globalThis.__WA_AI_BRIDGE_LISTENER__ = function (message, sender, sendResponse) {
    if (!message) return false;

    // ── AI Bridge: background → webapp → background ──
    if (message.source === "wa-background-bridge" && message.type === "ai-bridge-request") {
      var aibRequestId = message.requestId;

      function onAibWebappResponse(event) {
        if (event.source !== window) return;
        if (!isAllowedOrigin(event.origin)) return;
        var d = event.data;
        if (!d || d.direction !== "from-webapp-ai-bridge-response" || d.requestId !== aibRequestId) return;
        window.removeEventListener("message", onAibWebappResponse);
        try {
          chrome.runtime.sendMessage({
            source: "wa-content-bridge",
            type: "ai-bridge-response",
            requestId: aibRequestId,
            data: d.result || null,
          });
        } catch (err) { console.debug("[WA Content] AI bridge cleanup:", err?.message); }
      }
      window.addEventListener("message", onAibWebappResponse);
      setTimeout(function () { window.removeEventListener("message", onAibWebappResponse); }, 35000);

      post({
        direction: "from-extension-ai-bridge-request",
        requestId: aibRequestId,
        functionName: message.functionName,
        payload: message.payload,
      });
      return false;
    }

    // ── Optimus: background → webapp → background ──
    if (message.source === "wa-background-bridge" && message.type === "optimus-request") {
      var optRequestId = message.requestId;

      function onOptimusWebappResponse(event) {
        if (event.source !== window) return;
        if (!isAllowedOrigin(event.origin)) return;
        var d = event.data;
        if (!d || d.direction !== "from-webapp-optimus-response" || d.requestId !== optRequestId) return;
        window.removeEventListener("message", onOptimusWebappResponse);
        try {
          chrome.runtime.sendMessage({
            source: "wa-content-bridge",
            type: "optimus-response",
            requestId: optRequestId,
            data: d.result || null,
          });
        } catch (err) { console.debug("[WA Content] Optimus cleanup:", err?.message); }
      }
      window.addEventListener("message", onOptimusWebappResponse);
      setTimeout(function () { window.removeEventListener("message", onOptimusWebappResponse); }, 45000);

      post({
        direction: "from-extension-optimus-request",
        requestId: optRequestId,
        domSnapshot: message.domSnapshot,
        pageType: message.pageType,
        channel: message.channel || "whatsapp",
      });
      return false;
    }

    return false;
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

  // ── Message listener from webapp (with origin check) ──
  globalThis.__WA_MSG_LISTENER__ = function (event) {
    if (event.source !== window) return;
    // Origin check: only accept from our known app domains
    if (!isAllowedOrigin(event.origin)) return;

    var data = event.data;
    if (!data) return;
    if (data.direction !== "from-webapp-wa") return;
    relayMessage(data);
  };

  window.addEventListener("message", globalThis.__WA_MSG_LISTENER__);
  globalThis.__WA_EXTENSION_BRIDGE_ACTIVE__ = true;

  post({ direction: "from-extension-wa", action: "contentScriptReady" });
  scheduleHeartbeat();
})();
