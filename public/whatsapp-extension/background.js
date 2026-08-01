// ==================================================
// WhatsApp Extension v5.8.0 — Modular Architecture
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
    "optimus-client.js",
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
    globalThis.OptimusClient &&
    globalThis.Optimus &&
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
    var w = (typeof TabManager !== "undefined" && TabManager.getWorkerInfo) ? TabManager.getWorkerInfo() : { id: null, ready: false };
    sendResponse({
      success: true,
      version: chrome.runtime.getManifest().version,
      modulesLoaded: _modulesLoaded,
      workerTabId: w.id,
      workerReady: !!w.ready,
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

  remapSendDom: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.remapSendDom()); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.UNKNOWN, err.message)); }
    });
    return true;
  },

  getSendPlan: function (msg, sendResponse) {
    chrome.storage.local.get("wa_send_plan").then(function (r) {
      sendResponse({ success: true, plan: r.wa_send_plan || null });
    }).catch(function (err) {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  },

  // 5.10.18 — Pre-warm worker tab esplicito (chiamato dalla UI).
  ensureWorkerTab: function (msg, sendResponse) {
    if (typeof TabManager === "undefined" || !TabManager.ensureWorkerTab) {
      sendResponse({ success: false, error: "TabManager not loaded" });
      return false;
    }
    TabManager.enqueueSession(async function () {
      try {
        var t0 = Date.now();
        var res = await TabManager.ensureWorkerTab();
        sendResponse({
          success: !!(res && res.tab && res.tab.id),
          workerTabId: res && res.tab && res.tab.id,
          ready: true,
          reused: !!(res && res.reused),
          warmupMs: Date.now() - t0,
        });
      } catch (err) {
        sendResponse({ success: false, error: err && err.message });
      }
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
    // Route to Optimus module which manages pending plan requests
    if (typeof Optimus !== "undefined" && typeof Optimus.handlePlanResponse === "function") {
      Optimus.handlePlanResponse(message);
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
  console.log("[WhatsApp Extension v" + chrome.runtime.getManifest().version + "] Installed — Optimus V2.2");
  if (typeof Config !== "undefined") {
    await Config.load();
    if (typeof AiExtract !== "undefined") AiExtract.loadSchema().catch(function () {});
    if (typeof TabManager !== "undefined") TabManager.syncBridgeAcrossOpenTabs().catch(function () {});
    // 5.10.18 — Pre-warm worker tab (best-effort, non blocca).
    if (typeof TabManager !== "undefined" && TabManager.ensureWorkerTab) {
      TabManager.ensureWorkerTab().catch(function (e) {
        console.warn("[WA] worker pre-warm onInstalled failed:", e && e.message);
      });
    }
  }
});

chrome.runtime.onStartup.addListener(async function () {
  if (typeof Config !== "undefined") {
    await Config.load();
    if (typeof AiExtract !== "undefined") AiExtract.loadSchema().catch(function () {});
    if (typeof TabManager !== "undefined") TabManager.syncBridgeAcrossOpenTabs().catch(function () {});
    if (typeof TabManager !== "undefined" && TabManager.ensureWorkerTab) {
      TabManager.ensureWorkerTab().catch(function (e) {
        console.warn("[WA] worker pre-warm onStartup failed:", e && e.message);
      });
    }
  }
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (typeof Config !== "undefined" && typeof TabManager !== "undefined") {
    if (changeInfo.status === "complete" && tab.url && Config.isAppUrl(tab.url)) {
      TabManager.injectBridgeIntoTab(tabId).catch(function () {});
    }
  }
});

// 5.10.18 — Invalida cache worker quando la tab viene chiusa.
chrome.tabs.onRemoved.addListener(function (tabId) {
  if (typeof TabManager !== "undefined" && TabManager.invalidateWorker) {
    TabManager.invalidateWorker(tabId);
  }
});
