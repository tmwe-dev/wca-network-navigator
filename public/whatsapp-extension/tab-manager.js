// ══════════════════════════════════════════════
// WhatsApp Extension v5.0 — Tab Manager Module
// Tab lifecycle, queue serialization, hydration
// ══════════════════════════════════════════════

var TabManager = globalThis.TabManager || (function () {
  // ── Two-lane queue: session (lightweight) vs action (heavy) ──
  let _sessionQueue = Promise.resolve();
  let _actionQueue = Promise.resolve();

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

  // ── Safe tab operations with retry ──
  async function safeCreateTab(url, active) {
    for (let i = 0; i < 3; i++) {
      try {
        return await chrome.tabs.create({ url: url, active: active || false });
      } catch (e) {
        if (i < 2) await sleep(500 * (i + 1));
        else throw e;
      }
    }
  }

  async function safeRemoveTab(tabId) {
    try { await chrome.tabs.remove(tabId); } catch (err) { console.debug("[WA Tab]", err?.message); }
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

  function sortTabsByFreshness(tabs) {
    return (tabs || []).slice().sort(function (a, b) {
      const aScore = (a.active ? 1000 : 0) + (a.status === "complete" ? 100 : 0);
      const bScore = (b.active ? 1000 : 0) + (b.status === "complete" ? 100 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0);
    });
  }

  async function getBestExistingWaTab() {
    try {
      const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
      return sortTabsByFreshness(tabs)[0] || null;
    } catch (err) { console.debug("[WA Tab]", err?.message); return null; }
  }

  async function getLastFocusedActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return tabs && tabs[0] ? tabs[0] : null;
    } catch (err) { console.debug("[WA Tab]", err?.message); return null; }
  }

  // ── STEALTH MODE v2 (M4): brief tab activation for DOM rendering ──
  // Il DOM di WhatsApp è pesantemente throttled quando il tab è in background.
  // getBoundingClientRect() → 0, getComputedStyle() inaffidabile, elementi non renderizzati.
  // Soluzione: chrome.tabs.update({active:true}) attiva il tab NELLA SUA FINESTRA
  // senza chiamare chrome.windows.update({focused:true}), quindi la finestra
  // dell'utente (Cockpit) NON viene disturbata. Dopo l'attivazione, il tab originale
  // viene ripristinato.
  async function ensureTabVisibleAndWait(tabId, postActivateMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab) return false;
      // M4: Se il tab è nascosto, attivalo brevemente per forzare rendering DOM
      if (tab.active === false) {
        // Salva il tab attivo corrente nella stessa finestra
        let previousActiveTabId = null;
        try {
          const windowTabs = await chrome.tabs.query({ windowId: tab.windowId, active: true });
          if (windowTabs && windowTabs[0]) previousActiveTabId = windowTabs[0].id;
        } catch (err) { console.debug("[WA Tab] M4 save prev:", err?.message); }

        // Attiva il tab WA (rendering DOM si sblocca)
        try { await chrome.tabs.update(tabId, { active: true }); } catch (err) { console.debug("[WA Tab] M4 activate:", err?.message); }
        // Aspetta che il DOM si renderizzi
        await sleep(Math.min(postActivateMs || 600, 1500));

        // Ripristina il tab precedente (utente non se ne accorge)
        if (previousActiveTabId && previousActiveTabId !== tabId) {
          try { await chrome.tabs.update(previousActiveTabId, { active: true }); } catch (err) { console.debug("[WA Tab] M4 restore:", err?.message); }
        }
      } else {
        // Tab già attivo — solo sleep
        await sleep(Math.min(postActivateMs || 600, 1500));
      }
      return true;
    } catch (err) { console.debug("[WA Tab]", err?.message); return false; }
  }

  // M6: Backward-compat shim — ora usa ensureTabVisibleAndWait con M4 activation
  async function withTemporarilyVisibleTab(tabId, fn) {
    await ensureTabVisibleAndWait(tabId, 600);
    return await fn();
  }

  // ── Get or create WA tab ──
  async function getOrCreateWaTab() {
    try {
      const existing = await getBestExistingWaTab();
      if (existing) {
        if (existing.status !== "complete") await waitForLoad(existing.id, 15000);
        return { tab: existing, reused: true };
      }
    } catch (err) { console.debug("[WA Tab]", err?.message); }
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

  return {
    sleep: sleep,
    enqueueSession: enqueueSession,
    enqueueAction: enqueueAction,
    safeCreateTab: safeCreateTab,
    safeRemoveTab: safeRemoveTab,
    waitForLoad: waitForLoad,
    getBestExistingWaTab: getBestExistingWaTab,
    getOrCreateWaTab: getOrCreateWaTab,
    ensureTabVisibleAndWait: ensureTabVisibleAndWait,
    withTemporarilyVisibleTab: withTemporarilyVisibleTab,
    injectBridgeIntoTab: injectBridgeIntoTab,
    syncBridgeAcrossOpenTabs: syncBridgeAcrossOpenTabs,
  };
})();
globalThis.TabManager = TabManager;
