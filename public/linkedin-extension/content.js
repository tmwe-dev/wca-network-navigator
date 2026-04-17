// ══════════════════════════════════════════════
// LinkedIn Content Script Bridge v3.0
// Improved: 8s heartbeat with exponential backoff,
//           payload validation, structured error codes
// ══════════════════════════════════════════════

(function () {
  const BASE_HEARTBEAT_MS = 8000;
  const MAX_HEARTBEAT_MS = 30000;
  let currentHeartbeat = BASE_HEARTBEAT_MS;
  let alive = true;
  let heartbeatTimer = null;

  // Allowed actions whitelist
  const ALLOWED_ACTIONS = [
    "ping", "verifySession", "syncCookie", "autoLogin",
    "extractProfile", "sendMessage", "sendConnectionRequest",
    "searchProfile", "readLinkedInInbox", "readLinkedInThread",
    "diagnosticLinkedInDom", "learnDom", "setConfig",
  ];

  // Max payload sizes
  const MAX_STRING_LENGTH = 5000;

  function isExtensionAlive() {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) return false;
      void chrome.runtime.getManifest();
      return true;
    } catch (_) {
      return false;
    }
  }

  function post(payload) {
    try { window.postMessage(payload, window.location.origin); }
    catch (_) { window.postMessage(payload, "*"); }
  }

  function failResponse(data, error, errorCode) {
    post({
      direction: "from-extension-li",
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
    // Validate string fields don't exceed max length
    const stringFields = ["url", "message", "note", "query", "threadUrl"];
    for (let i = 0; i < stringFields.length; i++) {
      const field = stringFields[i];
      if (data[field] && typeof data[field] === "string" && data[field].length > MAX_STRING_LENGTH) {
        return "Field " + field + " exceeds max length";
      }
    }
    return null;
  }

  function relayMessage(data) {
    // Validate payload before relay
    const validationError = validatePayload(data);
    if (validationError) {
      failResponse(data, validationError, "ERR_VALIDATION");
      return;
    }

    if (!isExtensionAlive()) {
      alive = false;
      currentHeartbeat = BASE_HEARTBEAT_MS; // reset backoff
      failResponse(data, "Extension context invalidated — ricarica la pagina", "ERR_CONTEXT_DEAD");
      post({ direction: "from-extension-li", action: "extensionDead" });
      return;
    }

    try {
      const msg = { source: "li-content-bridge", action: data.action };
      if (data.url) msg.url = data.url;
      if (data.message) msg.message = data.message;
      if (data.note !== undefined) msg.note = data.note;
      if (data.query) msg.query = data.query;
      if (data.threadUrl) msg.threadUrl = data.threadUrl;
      if (data.pageType) msg.pageType = data.pageType;
      if (data.supabaseUrl) msg.supabaseUrl = data.supabaseUrl;
      if (data.supabaseAnonKey) msg.supabaseAnonKey = data.supabaseAnonKey;

      chrome.runtime.sendMessage(msg, function (response) {
        if (chrome.runtime.lastError) {
          alive = false;
          currentHeartbeat = BASE_HEARTBEAT_MS;
          failResponse(data, "Extension context invalidated", "ERR_RUNTIME");
          post({ direction: "from-extension-li", action: "extensionDead" });
          return;
        }

        alive = true;
        // Successful — increase heartbeat interval (backoff)
        currentHeartbeat = Math.min(currentHeartbeat * 1.5, MAX_HEARTBEAT_MS);

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
      currentHeartbeat = BASE_HEARTBEAT_MS;
      failResponse(data, "Extension context invalidated", "ERR_SEND_FAILED");
      post({ direction: "from-extension-li", action: "extensionDead" });
    }
  }

  // ── Adaptive heartbeat with exponential backoff ──
  function scheduleHeartbeat() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(function () {
      const nowAlive = isExtensionAlive();
      if (nowAlive && !alive) {
        alive = true;
        currentHeartbeat = BASE_HEARTBEAT_MS; // reset on reconnect
        post({ direction: "from-extension-li", action: "contentScriptReady" });
      } else if (!nowAlive && alive) {
        alive = false;
        currentHeartbeat = BASE_HEARTBEAT_MS;
        post({ direction: "from-extension-li", action: "extensionDead" });
      } else if (nowAlive) {
        // Stable — slowly increase interval
        currentHeartbeat = Math.min(currentHeartbeat * 1.2, MAX_HEARTBEAT_MS);
      }
      scheduleHeartbeat();
    }, currentHeartbeat);
  }

  window.addEventListener("message", function (event) {
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

    if (data.direction !== "from-webapp-li") return;
    relayMessage(data);
  });

  post({ direction: "from-extension-li", action: "contentScriptReady" });
  scheduleHeartbeat();
})();
