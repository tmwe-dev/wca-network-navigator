// ══════════════════════════════════════════════
// WhatsApp Extension v5.0 — Tab Manager Module
// Tab lifecycle, queue serialization, hydration
// ══════════════════════════════════════════════

const TabManager = (function () {
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
    try { await chrome.tabs.remove(tabId); } catch (_) {}
  }

  async function waitForLoad(tabId, timeoutMs) {
    const start = Date.now();
    const limit = timeoutMs || 30000;
    while (Date.now() - start < limit) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === "complete") return true;
      } catch (_) { return false; }
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
    } catch (_) { return null; }
  }

  async function getLastFocusedActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return tabs && tabs[0] ? tabs[0] : null;
    } catch (_) { return null; }
  }

  // ── Temporary tab activation for background hydration ──
  async function activateTabTemporarily(tabId) {
    try {
      const previous = await getLastFocusedActiveTab();
      if (!previous || previous.id !== tabId) {
        await chrome.tabs.update(tabId, { active: true });
        await sleep(900);
        return previous && typeof previous.id === "number" ? { tabId: previous.id } : null;
      }
    } catch (_) {}
    return null;
  }

  async function restoreTabContext(ctx) {
    if (!ctx || typeof ctx.tabId !== "number") return;
    try { await chrome.tabs.update(ctx.tabId, { active: true }); } catch (_) {}
  }

  async function withTemporarilyVisibleTab(tabId, fn) {
    const restoreCtx = await activateTabTemporarily(tabId);
    try {
      return await fn();
    } finally {
      await restoreTabContext(restoreCtx);
    }
  }

  // ── Get or create WA tab ──
  async function getOrCreateWaTab() {
    try {
      const existing = await getBestExistingWaTab();
      if (existing) {
        if (existing.status !== "complete") await waitForLoad(existing.id, 15000);
        return { tab: existing, reused: true };
      }
    } catch (_) {}
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
    } catch (_) { return false; }
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
    } catch (_) { return false; }
  }

  async function syncBridgeAcrossOpenTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      for (let i = 0; i < tabs.length; i++) {
        if (typeof tabs[i].id !== "number") continue;
        await injectBridgeIntoTab(tabs[i].id);
      }
    } catch (_) {}
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
    withTemporarilyVisibleTab: withTemporarilyVisibleTab,
    injectBridgeIntoTab: injectBridgeIntoTab,
    syncBridgeAcrossOpenTabs: syncBridgeAcrossOpenTabs,
  };
})();
