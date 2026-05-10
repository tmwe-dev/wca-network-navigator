// ══════════════════════════════════════════════════════════════
// LinkedIn Extension v3.0 — Modular Architecture
// background.js = Message Router only (no business logic)
// Modules: config.js, tab-manager.js, auth.js, ax-tree.js,
//          ai-learn.js, hybrid-ops.js, actions.js
// ══════════════════════════════════════════════════════════════

// ── Import all modules ──
try {
  importScripts(
    "config.js",
    "tab-manager.js",
    "ax-tree.js",
    "ai-bridge.js",
    "ai-learn.js",
    "auth.js",
    "hybrid-ops.js",
    "optimus-client.js",
    "actions.js"
  );
} catch (e) {
  console.error("[LI-EXT] Module import failed:", e);
}

// ── Action registry: maps action names to handler functions ──
const ACTION_HANDLERS = {
  ping: function (msg, sendResponse) {
    var w = (typeof TabManager !== "undefined" && TabManager.getWorkerInfo) ? TabManager.getWorkerInfo() : { id: null, ready: false };
    sendResponse({
      success: true,
      version: chrome.runtime.getManifest().version,
      workerTabId: w.id,
      workerReady: !!w.ready,
    });
    return false; // sync
  },

  setConfig: function (msg, sendResponse) {
    Config.save(msg.supabaseUrl, msg.supabaseAnonKey).then(function () {
      sendResponse({ success: true });
    });
    return true;
  },

  verifySession: function (msg, sendResponse) {
    TabManager.enqueueSession(async function () {
      try {
        const r = await Auth.verifySession();
        sendResponse({ success: true, authenticated: r.authenticated, reason: r.reason });
      } catch (err) {
        sendResponse(Config.errorResponse(Config.ERROR.UNKNOWN, err.message));
      }
    });
    return true;
  },

  syncCookie: function (msg, sendResponse) {
    TabManager.enqueueSession(async function () {
      try { sendResponse(await Auth.syncCookieToServer()); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.UNKNOWN, err.message)); }
    });
    return true;
  },

  autoLogin: function (msg, sendResponse) {
    TabManager.enqueueSession(async function () {
      try { sendResponse(await Auth.autoLogin()); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.LOGIN_FAILED, err.message)); }
    });
    return true;
  },

  extractProfile: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.extractProfileByUrl(msg.url)); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.EXTRACTION_FAILED, err.message)); }
    });
    return true;
  },

  sendMessage: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.sendLinkedInMessage(msg.url, msg.message)); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.MESSAGE_FAILED, err.message)); }
    });
    return true;
  },

  sendMessageWithMethod: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.sendLinkedInMessageWithMethod(msg.url, msg.message, msg.method)); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.MESSAGE_FAILED, err.message)); }
    });
    return true;
  },

  sendConnectionRequest: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.sendConnectionRequest(msg.url, msg.note)); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.CONNECT_FAILED, err.message)); }
    });
    return true;
  },

  searchProfile: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.searchProfile(msg.query)); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.SEARCH_FAILED, err.message)); }
    });
    return true;
  },

  readLinkedInInbox: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.readInbox()); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.INBOX_FAILED, err.message)); }
    });
    return true;
  },

  readLinkedInThread: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.readThread(msg.threadUrl)); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.INBOX_FAILED, err.message)); }
    });
    return true;
  },

  backfillLinkedInThread: function (msg, sendResponse) {
    if (!msg.threadUrl) {
      sendResponse(Config.errorResponse(Config.ERROR.INBOX_FAILED, "threadUrl richiesto"));
      return false;
    }
    TabManager.enqueueAction(async function () {
      try {
        sendResponse(await Actions.backfillThread(msg.threadUrl, msg.lastKnownText || "", msg.maxScrolls || 20));
      } catch (err) {
        sendResponse(Config.errorResponse(Config.ERROR.UNKNOWN, err.message));
      }
    });
    return true;
  },

  diagnosticLinkedInDom: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.diagnostic()); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.UNKNOWN, err.message)); }
    });
    return true;
  },

  learnDom: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.learnDom(msg.pageType)); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.AI_LEARN_FAILED, err.message)); }
    });
    return true;
  },

  remapSendDom: function (msg, sendResponse) {
    TabManager.enqueueAction(async function () {
      try { sendResponse(await Actions.remapSendDom()); }
      catch (err) { sendResponse(Config.errorResponse(Config.ERROR.AI_LEARN_FAILED, err.message)); }
    });
    return true;
  },

  getSendPlan: function (msg, sendResponse) {
    chrome.storage.local.get("li_dom_schema_messaging").then(function (r) {
      sendResponse({ success: true, plan: r.li_dom_schema_messaging || null });
    }).catch(function (err) {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  },

  // 3.9.57 — Pre-warm esplicito della worker tab (chiamato dalla UI).
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
          success: !!(res && res.id),
          workerTabId: res && res.id,
          ready: !!(res && res.ready),
          created: !!(res && res.created),
          adopted: !!(res && res.adopted),
          reused: !!(res && res.reused),
          warmupMs: Date.now() - t0,
          error: res && res.error,
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
  const source = message && message.source;
  if (source !== "li-content-bridge" && source !== "li-popup") return false;

  const handler = ACTION_HANDLERS[message.action];
  if (handler) {
    return handler(message, sendResponse);
  }

  sendResponse(Config.errorResponse(Config.ERROR.UNKNOWN, "Azione sconosciuta: " + message.action));
  return false;
});

// ── Lifecycle ──
chrome.runtime.onInstalled.addListener(async function () {
  console.log("[LinkedIn Extension v" + chrome.runtime.getManifest().version + "] Installed — Modular Architecture");
  await Config.load();
  Auth.syncCookieToServer().catch(function (err) {
    console.warn("[LI] Cookie sync failed on startup:", (err && err.message) || err);
  });
  // 3.9.57 — Lazy worker pre-warm: tentiamo, ma senza bloccare e senza
  // imporre una tab se l'utente non ha ancora effettuato il login.
  if (typeof TabManager !== "undefined" && TabManager.ensureWorkerTab) {
    TabManager.ensureWorkerTab().catch(function (e) {
      console.warn("[LI] worker pre-warm onInstalled failed:", e && e.message);
    });
  }
});

chrome.runtime.onStartup.addListener(async function () {
  await Config.load();
  if (typeof TabManager !== "undefined" && TabManager.ensureWorkerTab) {
    TabManager.ensureWorkerTab().catch(function (e) {
      console.warn("[LI] worker pre-warm onStartup failed:", e && e.message);
    });
  }
});

// 3.9.57 — Invalida la worker tab cache quando viene chiusa.
// La prossima azione la ricrea (lazy, no riapertura a sorpresa).
chrome.tabs.onRemoved.addListener(function (tabId) {
  if (typeof TabManager !== "undefined" && TabManager.invalidateWorker) {
    TabManager.invalidateWorker(tabId);
  }
});
