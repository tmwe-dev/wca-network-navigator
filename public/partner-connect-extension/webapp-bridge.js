// ══════════════════════════════════════════════════════════
// FireScrape — Webapp Bridge Content Script
// Bridges postMessage from the web app to the extension's
// background service worker (chrome.runtime.sendMessage).
// Same pattern as LinkedIn/WhatsApp extension bridges.
// ══════════════════════════════════════════════════════════

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
      // Build the message for background.js using FireScrape's native actions
      var msg = { action: data.action };

      // Pass through all payload fields
      if (data.url) msg.url = data.url;
      if (data.query) msg.query = data.query;
      if (data.schema) msg.schema = data.schema;
      if (data.config) msg.config = data.config;
      if (data.steps) msg.steps = data.steps;
      if (data.step) msg.step = data.step;
      if (data.skipCache !== undefined) msg.skipCache = data.skipCache;
      if (data.format) msg.format = data.format;
      if (data.selector) msg.selector = data.selector;
      if (data.text) msg.text = data.text;
      if (data.topic) msg.topic = data.topic;
      if (data.prompt) msg.prompt = data.prompt;
      if (data.body) msg.body = data.body;
      if (data.limit !== undefined) msg.limit = data.limit;

      chrome.runtime.sendMessage(msg, function (response) {
        if (chrome.runtime.lastError) {
          alive = false;
          console.warn("[FireScrape Bridge] Extension error:", chrome.runtime.lastError.message);
          failResponse(data, "Extension context invalidated");
          post({ direction: "from-extension-fs", action: "extensionDead" });
          return;
        }

        alive = true;

        // Normalize response — FireScrape returns data directly, not {success: true, ...}
        var resp = response || {};
        if (resp.error) {
          resp.success = false;
        } else if (resp.success === undefined) {
          resp.success = true;
        }

        post({
          direction: "from-extension-fs",
          action: data.action,
          requestId: data.requestId,
          response: resp,
        });

        if (data.action === "ping") {
          post({ direction: "from-extension-fs", action: "contentScriptReady" });
        }
      });
    } catch (err) {
      alive = false;
      console.warn("[FireScrape Bridge] sendMessage failed:", err.message);
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
      console.info("[FireScrape Bridge] Extension reconnected");
    } else if (!nowAlive && alive) {
      alive = false;
      post({ direction: "from-extension-fs", action: "extensionDead" });
      console.warn("[FireScrape Bridge] Extension context lost");
    }
  }, HEARTBEAT_MS);

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.direction !== "from-webapp-fs") return;
    relayMessage(data);
  });

  // Handle ping action in background for availability check
  // FireScrape background doesn't have a "ping" handler, so we handle it here
  var originalRelayMessage = relayMessage;
  relayMessage = function(data) {
    if (data.action === "ping") {
      // Respond directly — we know the extension is alive if we're executing
      if (isExtensionAlive()) {
        alive = true;
        post({
          direction: "from-extension-fs",
          action: "ping",
          requestId: data.requestId,
          response: { success: true, version: "3.3.0", engine: "firescrape" },
        });
        post({ direction: "from-extension-fs", action: "contentScriptReady" });
        return;
      }
    }
    originalRelayMessage(data);
  };

  post({ direction: "from-extension-fs", action: "contentScriptReady" });
  console.log("[FireScrape Bridge] Content script loaded — webapp bridge active");
})();
