// ══════════════════════════════════════════════════════════
// FireScrape — Webapp Bridge Content Script
// Bridges postMessage from the web app to the extension's
// background service worker (chrome.runtime.sendMessage).
// Handles: FireScrape (from-webapp-fs), WhatsApp (from-webapp-wa),
//          LinkedIn (from-webapp)
// ══════════════════════════════════════════════════════════

(function () {
  const HEARTBEAT_MS = 4000;
  let alive = true;

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

  function failResponse(direction, data, error) {
    post({
      direction: direction,
      action: data.action,
      requestId: data.requestId,
      response: { success: false, error: error },
    });
  }

  // ── FireScrape relay (from-webapp-fs → background.js) ──
  function relayFireScrape(data) {
    if (!isExtensionAlive()) {
      alive = false;
      failResponse("from-extension-fs", data, "Extension context invalidated — ricarica la pagina");
      post({ direction: "from-extension-fs", action: "extensionDead" });
      return;
    }

    // Ping handled locally
    if (data.action === "ping") {
      alive = true;
      post({
        direction: "from-extension-fs",
        action: "ping",
        requestId: data.requestId,
        response: { success: true, version: "3.4.0", engine: "firescrape" },
      });
      post({ direction: "from-extension-fs", action: "contentScriptReady" });
      return;
    }

    try {
      const msg = { action: data.action };
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
          failResponse("from-extension-fs", data, "Extension context invalidated");
          post({ direction: "from-extension-fs", action: "extensionDead" });
          return;
        }
        alive = true;
        const resp = response || {};
        if (resp.error) resp.success = false;
        else if (resp.success === undefined) resp.success = true;
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
      failResponse("from-extension-fs", data, "Extension context invalidated");
      post({ direction: "from-extension-fs", action: "extensionDead" });
    }
  }

  // ── WhatsApp relay (from-webapp-wa → background.js → wa-content.js on WhatsApp tab) ──
  function relayWhatsApp(data) {
    if (!isExtensionAlive()) {
      alive = false;
      failResponse("from-extension-wa", data, "Extension context invalidated — ricarica la pagina");
      post({ direction: "from-extension-wa", action: "extensionDead" });
      return;
    }

    // Ping handled locally — just check extension is alive
    if (data.action === "ping") {
      alive = true;
      post({
        direction: "from-extension-wa",
        action: "ping",
        requestId: data.requestId,
        response: { success: true, version: "3.4.0" },
      });
      post({ direction: "from-extension-wa", action: "contentScriptReady" });
      return;
    }

    try {
      // Relay to background.js which will forward to WhatsApp tab
      chrome.runtime.sendMessage(
        { type: "wa-relay", waAction: data.action, requestId: data.requestId, payload: data },
        function (response) {
          if (chrome.runtime.lastError) {
            alive = false;
            failResponse("from-extension-wa", data, "Extension context invalidated");
            post({ direction: "from-extension-wa", action: "extensionDead" });
            return;
          }
          alive = true;
          post({
            direction: "from-extension-wa",
            action: data.action,
            requestId: data.requestId,
            response: response || { success: false, error: "No response from WhatsApp tab" },
          });
        }
      );
    } catch (err) {
      alive = false;
      failResponse("from-extension-wa", data, "Extension context invalidated");
      post({ direction: "from-extension-wa", action: "extensionDead" });
    }
  }

  // ── LinkedIn relay (from-webapp → background.js) ──
  function relayLinkedIn(data) {
    if (!isExtensionAlive()) {
      alive = false;
      failResponse("from-extension", data, "Extension context invalidated");
      return;
    }

    if (data.action === "ping") {
      alive = true;
      post({
        direction: "from-extension",
        action: "ping",
        requestId: data.requestId,
        response: { success: true, version: "3.4.0" },
      });
      post({ direction: "from-extension", action: "contentScriptReady" });
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { type: "li-relay", liAction: data.action, requestId: data.requestId, payload: data },
        function (response) {
          if (chrome.runtime.lastError) {
            failResponse("from-extension", data, "Extension context invalidated");
            return;
          }
          alive = true;
          post({
            direction: "from-extension",
            action: data.action,
            requestId: data.requestId,
            response: response || { success: false, error: "No response" },
          });
        }
      );
    } catch (err) {
      failResponse("from-extension", data, "Extension context invalidated");
    }
  }

  // ── Listen for push events from background.js (WA sidebar changes) ──
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type === 'wa-push-event') {
      post({
        direction: 'from-extension-wa',
        action: 'sidebarChanged',
        timestamp: msg.timestamp,
      });
    }
  });

  // ── Heartbeat ──
  setInterval(function () {
    const nowAlive = isExtensionAlive();
    if (nowAlive && !alive) {
      alive = true;
      post({ direction: "from-extension-fs", action: "contentScriptReady" });
      post({ direction: "from-extension-wa", action: "contentScriptReady" });
      post({ direction: "from-extension", action: "contentScriptReady" });
    } else if (!nowAlive && alive) {
      alive = false;
      post({ direction: "from-extension-fs", action: "extensionDead" });
      post({ direction: "from-extension-wa", action: "extensionDead" });
      post({ direction: "from-extension", action: "extensionDead" });
    }
  }, HEARTBEAT_MS);

  // ── Message Router ──
  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || !data.direction) return;

    if (data.direction === "from-webapp-fs") relayFireScrape(data);
    else if (data.direction === "from-webapp-wa") relayWhatsApp(data);
    else if (data.direction === "from-webapp") relayLinkedIn(data);
  });

  // Announce all bridges
  post({ direction: "from-extension-fs", action: "contentScriptReady" });
  post({ direction: "from-extension-wa", action: "contentScriptReady" });
  post({ direction: "from-extension", action: "contentScriptReady" });
  console.log("[Bridge] Unified webapp bridge loaded — v3.4.0 (FS + WA + LI)");
})();
