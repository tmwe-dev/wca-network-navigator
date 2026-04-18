// ==================================================
// WhatsApp Extension v5.4.0 — Modular Architecture
// background.js = Message Router only
// Modules: config, tab-manager, discovery,
//          ai-bridge, ai-extract, actions
// ==================================================

try {
  importScripts(
    "config.js",
    "tab-manager.js",
    "discovery.js",
    "ai-bridge.js",
    "ai-extract.js",
    "actions.js"
  );
} catch (e) {
  console.error("[WA-EXT] Module import failed:", e);
}

// ── Module load check (via globalThis: works after SW restart in MV3) ──
function _checkModules() {
  return !!(
    globalThis.Config &&
    globalThis.TabManager &&
    globalThis.Discovery &&
    globalThis.AiBridge &&
    globalThis.AiExtract &&
    globalThis.Actions
  );
}

var _modulesLoaded = _checkModules();

if (!_modulesLoaded) {
  console.error("[WA-EXT] One or more modules failed to load.",
    "Config:", !!globalThis.Config,
    "TabManager:", !!globalThis.TabManager,
    "Discovery:", !!globalThis.Discovery,
    "AiBridge:", !!globalThis.AiBridge,
    "AiExtract:", !!globalThis.AiExtract,
    "Actions:", !!globalThis.Actions);
}

// ── Action registry ──
var ACTION_HANDLERS = {
  ping: function (msg, sendResponse) {
    sendResponse({
      success: true,
      version: "5.4.1",
      modulesLoaded: _modulesLoaded,
    });
    return false;
  },

  setConfig: function (msg, sendResponse) {
    if (typeof Config === "undefined") {
      sendResponse({ success: false, error: "Config module not loaded" });
      return false;
    }
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
  if (!message) return false;

  // Handle AI bridge responses from content script
  if (message.source === "wa-content-bridge" && message.type === "ai-bridge-response") {
    if (typeof AiBridge !== "undefined") {
      AiBridge.handleResponse(message);
    }
    return false;
  }

  // Handle Optimus responses from content script
  if (message.source === "wa-content-bridge" && message.type === "optimus-response") {
    if (typeof OptimusClient !== "undefined" && typeof OptimusClient.handleResponse === "function") {
      OptimusClient.handleResponse(message);
    } else if (typeof AiBridge !== "undefined") {
      // Fallback: route optimus responses through AiBridge
      AiBridge.handleResponse({ ...message, type: "ai-bridge-response" });
    }
    return false;
  }

  // Handle normal actions from content script
  if (message.source !== "wa-content-bridge") return false;

  if (!_modulesLoaded) {
    sendResponse({ success: false, error: "Extension modules not loaded — reinstall extension", errorCode: "ERR_MODULES" });
    return false;
  }

  var handler = ACTION_HANDLERS[message.action];
  if (handler) return handler(message, sendResponse);

  sendResponse(Config.errorResponse(Config.ERROR.UNKNOWN, "Azione sconosciuta: " + message.action));
  return false;
});

// ── Lifecycle ──
chrome.runtime.onInstalled.addListener(async function () {
  console.log("[WhatsApp Extension v5.4.0] Installed — Modular Architecture");
  if (typeof Config !== "undefined") {
    await Config.load();
    if (typeof AiExtract !== "undefined") AiExtract.loadSchema().catch(function () {});
    if (typeof TabManager !== "undefined") TabManager.syncBridgeAcrossOpenTabs().catch(function () {});
  }
});

chrome.runtime.onStartup.addListener(async function () {
  if (typeof Config !== "undefined") {
    await Config.load();
    if (typeof AiExtract !== "undefined") AiExtract.loadSchema().catch(function () {});
    if (typeof TabManager !== "undefined") TabManager.syncBridgeAcrossOpenTabs().catch(function () {});
  }
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (typeof Config !== "undefined" && typeof TabManager !== "undefined") {
    if (changeInfo.status === "complete" && tab.url && Config.isAppUrl(tab.url)) {
      TabManager.injectBridgeIntoTab(tabId).catch(function () {});
    }
  }
});
