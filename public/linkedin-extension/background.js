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
    sendResponse({ success: true, version: "3.3.0" });
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
  console.log("[LinkedIn Extension v3.0] Installed — Modular Architecture");
  await Config.load();
  Auth.syncCookieToServer().catch(function () {});
});

chrome.runtime.onStartup.addListener(async function () {
  await Config.load();
});
