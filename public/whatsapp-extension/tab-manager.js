// ══════════════════════════════════════════════
// WhatsApp Extension v5.10 — Tab Manager Module
// AUTOMATION WINDOW ISOLATION (no focus stealing)
// ══════════════════════════════════════════════

var TabManager = globalThis.TabManager || (function () {
  // ── Two-lane queue: session (lightweight) vs action (heavy) ──
  let _sessionQueue = Promise.resolve();
  let _actionQueue = Promise.resolve();

  // ── Automation window/tab ownership (persisted in chrome.storage.session) ──
  let _automationWindowId = null;
  let _ownedWaTabIds = new Set();

  function enqueueSession(fn) {
    _sessionQueue = _sessionQueue.then(fn).catch(function (e) {
      console.error("[WA TabMgr] Session queue error:", e);
    });
  }

  function enqueueAction(fn) {
    _actionQueue = _actionQueue.then(fn).catch(function (e) {
      console.error("[WA TabMgr] Action queue error:", e);
    });
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // ── Persistence helpers (service worker may restart) ──
  async function loadOwnership() {
    try {
      const data = await chrome.storage.session.get(["wa_automation_window", "wa_owned_tabs"]);
      if (data.wa_automation_window) _automationWindowId = data.wa_automation_window;
      if (Array.isArray(data.wa_owned_tabs)) _ownedWaTabIds = new Set(data.wa_owned_tabs);
    } catch (e) { /* session storage may be unavailable */ }
  }

  async function saveOwnership() {
    try {
      await chrome.storage.session.set({
        wa_automation_window: _automationWindowId,
        wa_owned_tabs: Array.from(_ownedWaTabIds),
      });
    } catch (e) { /* ignore */ }
  }

  function markOwned(tabId) {
    _ownedWaTabIds.add(tabId);
    saveOwnership();
  }

  function isOwned(tabId) {
    return _ownedWaTabIds.has(tabId);
  }

  // ── Get or create the dedicated AUTOMATION WINDOW (non-focused) ──
  // This window lives off-screen / minimized and never steals focus.
  async function getOrCreateAutomationWindow() {
    await loadOwnership();
    // Validate cached window
    if (_automationWindowId !== null) {
      try {
        const win = await chrome.windows.get(_automationWindowId);
        if (win) return _automationWindowId;
      } catch (e) {
        _automationWindowId = null;
      }
    }
    // Create a NEW minimized window for automation
    try {
      const win = await chrome.windows.create({
        url: "about:blank",
        focused: false,
        state: "minimized",
        type: "normal",
      });
      _automationWindowId = win.id;
      // Some platforms ignore focused:false on create — force unfocus by
      // re-focusing the previously focused window if we know it.
      try {
        const allWins = await chrome.windows.getAll();
        const userWin = allWins.find(function (w) { return w.id !== win.id && w.type === "normal"; });
        if (userWin) {
          await chrome.windows.update(userWin.id, { focused: true });
        }
      } catch (e) { /* ignore */ }
      // Remove the placeholder about:blank tab once the window exists
      try {
        if (win.tabs && win.tabs[0]) {
          // Keep it as a placeholder — we'll close it after we have a real WA tab
          markOwned(win.tabs[0].id);
        }
      } catch (e) { /* ignore */ }
      await saveOwnership();
      return _automationWindowId;
    } catch (e) {
      console.warn("[WA TabMgr] Failed to create automation window:", e?.message);
      _automationWindowId = null;
      return null;
    }
  }

  // ── Safe tab operations with retry ──
  async function safeCreateTab(url, active) {
    for (let i = 0; i < 3; i++) {
      try {
        // Always try to create in the automation window first
        const winId = await getOrCreateAutomationWindow();
        const opts = { url: url, active: !!active };
        if (winId !== null) opts.windowId = winId;
        const tab = await chrome.tabs.create(opts);
        markOwned(tab.id);
        return tab;
      } catch (e) {
        if (i < 2) await sleep(500 * (i + 1));
        else {
          // Last resort: create without windowId (background tab in current window)
          // BUT we still mark it owned so we don't steal focus from it
          const tab = await chrome.tabs.create({ url: url, active: false });
          markOwned(tab.id);
          return tab;
        }
      }
    }
  }

  async function safeRemoveTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      _ownedWaTabIds.delete(tabId);
      saveOwnership();
    } catch (err) { console.debug("[WA Tab]", err?.message); }
  }

  async function waitForLoad(tabId, timeoutMs) {
    const start = Date.now();
    const limit = timeoutMs || 30000;
    while (Date.now() - start < limit) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === "complete") return true;
      } catch (err) { console.debug("[WA Tab]", err?.message); return false; }
      await sleep(500);
    }
    return false;
  }

  // ── REUSE LOGIC: only OWNED tabs are eligible (never user tabs) ──
  async function getBestExistingWaTab() {
    await loadOwnership();
    try {
      // Step 1: look ONLY among owned tabs
      const owned = Array.from(_ownedWaTabIds);
      for (const tid of owned) {
        try {
          const t = await chrome.tabs.get(tid);
          if (t && t.url && /web\.whatsapp\.com/i.test(t.url)) return t;
        } catch (e) {
          // Tab no longer exists — clean up
          _ownedWaTabIds.delete(tid);
        }
      }
      saveOwnership();
      // Step 2: look in the automation window only
      if (_automationWindowId !== null) {
        try {
          const tabs = await chrome.tabs.query({
            windowId: _automationWindowId,
            url: "https://web.whatsapp.com/*",
          });
          if (tabs && tabs[0]) {
            markOwned(tabs[0].id);
            return tabs[0];
          }
        } catch (e) { /* window gone */ }
      }
      // We deliberately do NOT reuse user-opened web.whatsapp.com tabs
      return null;
    } catch (err) { console.debug("[WA Tab]", err?.message); return null; }
  }

  async function getLastFocusedActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return tabs && tabs[0] ? tabs[0] : null;
    } catch (err) { console.debug("[WA Tab]", err?.message); return null; }
  }

  // ── Move tab into the automation window if it isn't already there ──
  async function ensureTabInAutomationWindow(tabId) {
    try {
      const winId = await getOrCreateAutomationWindow();
      if (winId === null) return false;
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId === winId) return true;
      // Move it — this happens silently and does NOT steal focus
      await chrome.tabs.move(tabId, { windowId: winId, index: -1 });
      return true;
    } catch (e) {
      console.debug("[WA TabMgr] ensureTabInAutomationWindow:", e?.message);
      return false;
    }
  }

  // ── OPTIMUS V2.1 (FOCUS-SAFE): activateAndStabilize ──
  // CONTRACT: NEVER call chrome.tabs.update({active:true}) on a tab that lives
  // in a window the user is currently working in.
  //
  // Strategy:
  //   1. Ensure the tab is in our automation window (move it if not).
  //   2. Activate it ONLY inside the automation window.
  //   3. The automation window stays minimized/unfocused — Cockpit untouched.
  //   4. No restore() is needed because we never touched the user's window.
  async function activateAndStabilize(tabId, maxWaitMs) {
    // Move tab to automation window (silent — no focus change)
    await ensureTabInAutomationWindow(tabId);

    // Activate ONLY within the automation window. If the move failed and the
    // tab is still in a user window, we MUST NOT activate it. Probe DOM as-is.
    let activatedInAutomation = false;
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId === _automationWindowId) {
        await chrome.tabs.update(tabId, { active: true });
        activatedInAutomation = true;
      } else {
        console.warn("[WA TabMgr] Tab " + tabId + " not in automation window — skipping activate to preserve user focus");
      }
    } catch (err) { console.debug("[WA Tab] V2.1 activate:", err?.message); }

    // Wait for DOM stable (works even without activation thanks to MV3 scripting)
    const startTime = Date.now();
    const maxWait = maxWaitMs || 3000;
    let stable = false;
    while (Date.now() - startTime < maxWait) {
      try {
        const check = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: function () {
            return {
              ready: document.readyState === "complete",
              hasContent: !!(
                document.querySelector('[role="row"]') ||
                document.querySelector('#pane-side') ||
                document.querySelector('[role="grid"]')
              ),
              loading: !!(
                document.querySelector('[data-testid="startup"]') ||
                document.querySelector('.landing-window')
              ),
            };
          },
        });
        const r = check && check[0] && check[0].result;
        // We do NOT require visibilityState=visible anymore — minimized
        // automation window will report "hidden", but DOM is rendered.
        if (r && r.ready && r.hasContent && !r.loading) { stable = true; break; }
      } catch (err) { console.debug("[WA Tab] V2.1 probe:", err?.message); }
      await sleep(300);
    }
    if (stable) await sleep(500);

    return {
      stable: stable,
      previousTabId: null, // never changed user's window
      activatedInAutomation: activatedInAutomation,
      restore: async function () {
        // No-op: we never stole focus
        return;
      },
    };
  }

  // ── DEPRECATED shim — now delegates to focus-safe activateAndStabilize ──
  // Kept for backward-compat with verifySession and legacy paths.
  async function ensureTabVisibleAndWait(tabId, postActivateMs) {
    const res = await activateAndStabilize(tabId, Math.max(postActivateMs || 600, 1500));
    return !!res.stable || !!res.activatedInAutomation;
  }

  // ── DEPRECATED shim ──
  async function withTemporarilyVisibleTab(tabId, fn) {
    await ensureTabVisibleAndWait(tabId, 600);
    return await fn();
  }

  // ── Get or create WA tab (always in automation window) ──
  async function getOrCreateWaTab() {
    try {
      const existing = await getBestExistingWaTab();
      if (existing) {
        if (existing.status !== "complete") await waitForLoad(existing.id, 15000);
        // Make sure it lives in the automation window
        await ensureTabInAutomationWindow(existing.id);
        return { tab: existing, reused: true };
      }
    } catch (err) { console.debug("[WA Tab]", err?.message); }

    // Create fresh in automation window
    const tab = await safeCreateTab(Config.WA_BASE, false);
    const loaded = await waitForLoad(tab.id, 30000);
    if (!loaded) throw new Error("WhatsApp Web non caricato");
    await sleep(4000);
    return { tab: tab, reused: false };
  }

  // ── Bridge injection ──
  async function injectBridgeIntoFrame(tabId, frameId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId, frameIds: [frameId] },
        files: ["content.js"],
      });
      return true;
    } catch (err) { console.debug("[WA Tab]", err?.message); return false; }
  }

  async function injectBridgeIntoTab(tabId) {
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId: tabId });
      if (!frames || !frames.length) return false;
      let injected = false;
      for (let i = 0; i < frames.length; i++) {
        if (!Config.isAppUrl(frames[i].url)) continue;
        const ok = await injectBridgeIntoFrame(tabId, frames[i].frameId);
        injected = ok || injected;
      }
      return injected;
    } catch (err) { console.debug("[WA Tab]", err?.message); return false; }
  }

  async function syncBridgeAcrossOpenTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      for (let i = 0; i < tabs.length; i++) {
        if (typeof tabs[i].id !== "number") continue;
        await injectBridgeIntoTab(tabs[i].id);
      }
    } catch (err) { console.debug("[WA Tab]", err?.message); }
  }

  // Initialize ownership cache from session storage
  loadOwnership();

  return {
    sleep: sleep,
    enqueueSession: enqueueSession,
    enqueueAction: enqueueAction,
    safeCreateTab: safeCreateTab,
    safeRemoveTab: safeRemoveTab,
    waitForLoad: waitForLoad,
    getBestExistingWaTab: getBestExistingWaTab,
    getOrCreateWaTab: getOrCreateWaTab,
    getOrCreateAutomationWindow: getOrCreateAutomationWindow,
    ensureTabInAutomationWindow: ensureTabInAutomationWindow,
    isOwned: isOwned,
    activateAndStabilize: activateAndStabilize,
    ensureTabVisibleAndWait: ensureTabVisibleAndWait,
    withTemporarilyVisibleTab: withTemporarilyVisibleTab,
    injectBridgeIntoTab: injectBridgeIntoTab,
    syncBridgeAcrossOpenTabs: syncBridgeAcrossOpenTabs,
  };
})();
globalThis.TabManager = TabManager;
