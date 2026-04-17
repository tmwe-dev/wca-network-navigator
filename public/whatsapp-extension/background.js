// ══════════════════════════════════════════════
// WhatsApp Extension v5.0 — Modular Architecture
// background.js = Message Router only (no business logic)
// Modules: config.js, tab-manager.js, discovery.js,
//          ai-extract.js, actions.js
// ══════════════════════════════════════════════

try {
  importScripts(
    "config.js",
    "tab-manager.js",
    "discovery.js",
    "ai-bridge.js",
    "ai-extract.js",
    "optimus-client.js",
    "actions.js"
  );
} catch (e) {
  console.error("[WA-EXT] Module import failed:", e);
}

// ── Action registry ──
const ACTION_HANDLERS = {
  ping: function (msg, sendResponse) {
    sendResponse({ success: true, version: "5.3.1" });
    return false;
  },

  setConfig: function (msg, sendResponse) {
    Config.save(msg.supabaseUrl, msg.anonKey, msg.authToken).then(function () {
      sendResponse({ success: true });
    });
    return true;
  },

  verifySession: function (msg, sendResponse) {
    TabManager.enqueueSession(async function () {
      try { sendResponse(await Actions.verifySession()); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.SESSION_FAILED, err.message)); }
    });
    return true;
  },

  sendWhatsApp: function (msg, sendResponse) {
    if (!msg.phone || !msg.text) {
      sendResponse(Config.errorResponse(Config.ERROR.VALIDATION, "phone e text richiesti"));
      return false;
    }
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.sendWhatsAppMessage(msg.phone, msg.text)); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.SEND_FAILED, err.message)); }
    });
    return true;
  },

  readUnread: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.readUnreadMessages()); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.READ_FAILED, err.message)); }
    });
    return true;
  },

  learnDom: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await AiExtract.learnDomSelectors()); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.LEARN_FAILED, err.message)); }
    });
    return true;
  },

  diagnosticDom: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.diagnostic()); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.DIAGNOSTIC_FAILED, err.message)); }
    });
    return true;
  },

  readThread: function (msg, sendResponse) {
    if (!msg.contact) {
      sendResponse(Config.errorResponse(Config.ERROR.VALIDATION, "contact richiesto"));
      return false;
    }
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.readThread(msg.contact, msg.maxMessages || 50)); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.THREAD_FAILED, err.message)); }
    });
    return true;
  },

  backfillChat: function (msg, sendResponse) {
    if (!msg.contact) {
      sendResponse(Config.errorResponse(Config.ERROR.VALIDATION, "contact richiesto"));
      return false;
    }
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.backfillChat(msg.contact, msg.lastKnownText || "", msg.maxScrolls || 30)); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.BACKFILL_FAILED, err.message)); }
    });
    return true;
  },
};

// ── Single message listener ──
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || message.source !== "wa-content-bridge") return false;

  const handler = ACTION_HANDLERS[message.action];
  if (handler) return handler(message, sendResponse);

  sendResponse(Config.errorResponse(Config.ERROR.UNKNOWN, "Azione sconosciuta: " + message.action));
  return false;
});

// ── Lifecycle ──
chrome.runtime.onInstalled.addListener(async function () {
  console.log("[WhatsApp Extension v5.0] Installed — Modular Architecture");
  await Config.load();
  AiExtract.loadSchema().catch(function () {});
  TabManager.syncBridgeAcrossOpenTabs().catch(function () {});
});

chrome.runtime.onStartup.addListener(async function () {
  await Config.load();
  AiExtract.loadSchema().catch(function () {});
  TabManager.syncBridgeAcrossOpenTabs().catch(function () {});
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status === "complete" && tab.url && Config.isAppUrl(tab.url)) {
    TabManager.injectBridgeIntoTab(tabId).catch(function () {});
  }
});
