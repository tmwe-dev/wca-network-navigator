// ══════════════════════════════════════════════
// LinkedIn Content Script Bridge v3.3.0
// Idempotent: cleans previous injection state before binding new listeners
// Origin-restricted: only accepts messages from trusted webapp origins
// Visibility gate moved to background (per-action ensureTabVisibleAndWait)
// ══════════════════════════════════════════════

(function () {
  // ── Cleanup from previous injection ──
  if (globalThis.__LI_MSG_LISTENER__) {
    try { window.removeEventListener("message", globalThis.__LI_MSG_LISTENER__); } catch (_) {}
  }
  if (globalThis.__LI_HEARTBEAT_TIMER__) {
    try { clearTimeout(globalThis.__LI_HEARTBEAT_TIMER__); } catch (_) {}
    globalThis.__LI_HEARTBEAT_TIMER__ = null;
  }
  if (globalThis.__LI_OPTIMUS_REQUEST_LISTENER__) {
    try { chrome.runtime.onMessage.removeListener(globalThis.__LI_OPTIMUS_REQUEST_LISTENER__); } catch (_) {}
  }

  const BASE_HEARTBEAT_MS = 8000;
  const MAX_HEARTBEAT_MS = 30000;
  let currentHeartbeat = BASE_HEARTBEAT_MS;
  let alive = true;

  // Allowed actions whitelist
  const ALLOWED_ACTIONS = [
    "ping", "verifySession", "syncCookie", "autoLogin",
    "extractProfile", "sendMessage", "sendConnectionRequest",
    "searchProfile", "readLinkedInInbox", "readLinkedInThread",
    "backfillLinkedInThread",
    "diagnosticLinkedInDom", "learnDom", "setConfig",
  ];

  // Max payload sizes
  const MAX_STRING_LENGTH = 5000;

  // ── Origin check: only accept messages from trusted webapp domains ──
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
    const stringFields = ["url", "message", "note", "query", "threadUrl", "lastKnownText"];
    for (let i = 0; i < stringFields.length; i++) {
      const field = stringFields[i];
      if (data[field] && typeof data[field] === "string" && data[field].length > MAX_STRING_LENGTH) {
        return "Field " + field + " exceeds max length";
      }
    }
    return null;
  }

  async function relayMessage(data) {
    // Validate payload before relay
    const validationError = validatePayload(data);
    if (validationError) {
      failResponse(data, validationError, "ERR_VALIDATION");
      return;
    }

    if (!isExtensionAlive()) {
      alive = false;
      currentHeartbeat = BASE_HEARTBEAT_MS;
      failResponse(data, "Extension context invalidated — ricarica la pagina", "ERR_CONTEXT_DEAD");
      post({ direction: "from-extension-li", action: "extensionDead" });
      return;
    }

    // NOTE: Visibility gate removed from content script.
    // This script runs in the WEBAPP tab, not the LinkedIn tab — so document.visibilityState
    // here reflects the webapp's visibility, not LinkedIn's. The proper visibility check
    // happens in actions.js via TabManager.ensureTabVisibleAndWait(tabId).

    try {
      const msg = { source: "li-content-bridge", action: data.action };
      if (data.url) msg.url = data.url;
      if (data.message) msg.message = data.message;
      if (data.note !== undefined) msg.note = data.note;
      if (data.query) msg.query = data.query;
      if (data.threadUrl) msg.threadUrl = data.threadUrl;
      if (data.lastKnownText) msg.lastKnownText = data.lastKnownText;
      if (data.maxScrolls) msg.maxScrolls = data.maxScrolls;
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

  // ── Adaptive heartbeat with exponential backoff (idempotent across reinjections) ──
  function scheduleHeartbeat() {
    if (globalThis.__LI_HEARTBEAT_TIMER__) clearTimeout(globalThis.__LI_HEARTBEAT_TIMER__);
    globalThis.__LI_HEARTBEAT_TIMER__ = setTimeout(function () {
      const nowAlive = isExtensionAlive();
      if (nowAlive && !alive) {
        alive = true;
        currentHeartbeat = BASE_HEARTBEAT_MS;
        post({ direction: "from-extension-li", action: "contentScriptReady" });
      } else if (!nowAlive && alive) {
        alive = false;
        currentHeartbeat = BASE_HEARTBEAT_MS;
        post({ direction: "from-extension-li", action: "extensionDead" });
      } else if (nowAlive) {
        currentHeartbeat = Math.min(currentHeartbeat * 1.2, MAX_HEARTBEAT_MS);
      }
      scheduleHeartbeat();
    }, currentHeartbeat);
  }

  // ── Main listener (saved on globalThis for cleanup on re-inject) ──
  globalThis.__LI_MSG_LISTENER__ = function (event) {
    if (event.source !== window) return;
    if (!isAllowedOrigin(event.origin)) return;
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
  };

  window.addEventListener("message", globalThis.__LI_MSG_LISTENER__);

  globalThis.__LI_OPTIMUS_REQUEST_LISTENER__ = function (msg, sender, sendResponse) {
    // ── AI Bridge: background → webapp via postMessage ──
    if (msg && msg.action === "aiBridgeRequest") {
      const reqId = msg.requestId;
      const responseDirection = msg.responseDirection;

      window.postMessage({
        direction: msg.direction,
        requestId: reqId,
        payload: msg.payload || {},
      }, "*");

      var finishedAi = false;
      var timerAi = setTimeout(function () {
        if (finishedAi) return;
        finishedAi = true;
        window.removeEventListener("message", aiHandler);
        try {
          chrome.runtime.sendMessage({
            source: "li-ai-bridge-response",
            requestId: reqId,
            payload: { success: false, error: "WEBAPP_TIMEOUT" },
          });
        } catch (_) {}
        sendResponse({ ok: true });
      }, 14000);

      function aiHandler(event) {
        if (event.source !== window) return;
        if (!isAllowedOrigin(event.origin)) return;
        const d = event.data;
        if (!d || d.direction !== responseDirection) return;
        if (d.requestId && d.requestId !== reqId) return;
        if (finishedAi) return;
        finishedAi = true;
        clearTimeout(timerAi);
        window.removeEventListener("message", aiHandler);
        try {
          chrome.runtime.sendMessage({
            source: "li-ai-bridge-response",
            requestId: reqId,
            payload: d.payload || { success: false, error: "EMPTY" },
          });
        } catch (_) {}
        sendResponse({ ok: true });
      }

      window.addEventListener("message", aiHandler);
      return true;
    }

    if (!msg || msg.action !== "optimusRequest") return false;

    window.postMessage({
      direction: "from-extension-optimus-request",
      payload: msg.payload,
    }, "*");

    var finished = false;
    var timer = setTimeout(function () {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", handler);
      sendResponse({ success: false, error: "OPTIMUS_TIMEOUT" });
    }, 15000);

    function handler(event) {
      if (event.source !== window) return;
      if (!isAllowedOrigin(event.origin)) return;
      if (!event.data || event.data.direction !== "from-webapp-optimus-response") return;
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      window.removeEventListener("message", handler);
      sendResponse(event.data.payload);
    }

    window.addEventListener("message", handler);
    return true;
  };

  chrome.runtime.onMessage.addListener(globalThis.__LI_OPTIMUS_REQUEST_LISTENER__);

  post({ direction: "from-extension-li", action: "contentScriptReady" });
  scheduleHeartbeat();
})();
