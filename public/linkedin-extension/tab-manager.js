// ══════════════════════════════════════════════════
// LinkedIn Extension — Tab Manager Module
// Centralizes tab lifecycle: create, reuse, navigate, wait
// Queue system with priority lanes
// ══════════════════════════════════════════════════

var TabManager = globalThis.TabManager || (function () {
  let _liTabId = null;

  // ── Retry-safe tab creation ──
  async function safeCreate(options, maxRetries) {
    maxRetries = maxRetries || 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await chrome.tabs.create(options);
      } catch (err) {
        if (attempt < maxRetries - 1 && /cannot be edited/i.test(err.message)) {
          await sleep(500 * (attempt + 1));
        } else {
          throw err;
        }
      }
    }
  }

  function safeRemove(tabId) {
    if (tabId === _liTabId) return Promise.resolve();
    return chrome.tabs.remove(tabId).catch(function () {});
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function waitForLoad(tabId, ms) {
    ms = ms || 20000;
    return new Promise(function (resolve) {
      const timeout = setTimeout(function () {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, ms);

      function listener(id, info) {
        if (id === tabId && info.status === "complete") {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(resolve, 2000);
        }
      }

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  // ── Get or create the main LinkedIn tab ──
  // Check if tab URL matches the requested URL (not just domain)
  function urlMatchesTarget(tabUrl, targetUrl) {
    if (!tabUrl || !targetUrl) return false;
    try {
      const current = new URL(tabUrl);
      const target = new URL(targetUrl);
      // Exact pathname match (e.g. /messaging/ vs /messaging/thread/xxx)
      const currentPath = current.pathname.replace(/\/$/, "");
      const targetPath = target.pathname.replace(/\/$/, "");
      return current.hostname === target.hostname && currentPath === targetPath;
    } catch (err) { console.debug("[LI Tab]", err?.message); return false; }
  }

  async function getLinkedInTab(url, skipNavigateIfSameDomain) {
    // Try reusing cached tab
    if (_liTabId !== null) {
      try {
        const existing = await chrome.tabs.get(_liTabId);
        if (existing) {
          if (skipNavigateIfSameDomain && existing.url && /linkedin\.com/i.test(existing.url) && urlMatchesTarget(existing.url, url)) {
            if (existing.status !== "complete") await waitForLoad(_liTabId, 15000);
            return { id: _liTabId, reused: true };
          }
          await chrome.tabs.update(_liTabId, { url: url });
          await waitForLoad(_liTabId, 20000);
          return { id: _liTabId, reused: false };
        }
      } catch (err) {
        _liTabId = null;
      }
    }

    // M1: Service worker MV3 può riavviarsi → _liTabId perso.
    // Cercare tab LinkedIn esistenti PRIMA di crearne uno nuovo.
    try {
      const allTabs = await chrome.tabs.query({ url: "*://*.linkedin.com/*" });
      if (allTabs && allTabs.length > 0) {
        // Preferire tab non attivi (creati dall'estensione) rispetto a quelli utente
        const best = allTabs.find(function (t) { return !t.active; }) || allTabs[0];
        _liTabId = best.id;
        console.log("[LI Tab] M1: Riusato tab esistente #" + best.id + " (url: " + (best.url || "").substring(0, 60) + ")");
        if (skipNavigateIfSameDomain && best.url && urlMatchesTarget(best.url, url)) {
          if (best.status !== "complete") await waitForLoad(_liTabId, 15000);
          return { id: _liTabId, reused: true };
        }
        await chrome.tabs.update(_liTabId, { url: url });
        await waitForLoad(_liTabId, 20000);
        return { id: _liTabId, reused: false };
      }
    } catch (queryErr) {
      console.debug("[LI Tab] M1: query tabs failed:", queryErr?.message);
    }

    // Nessun tab LinkedIn trovato — creane uno in background
    const tab = await safeCreate({ url: url, active: false });
    _liTabId = tab.id;
    await waitForLoad(tab.id, 20000);
    return tab;
  }

  function getTabId() {
    return _liTabId;
  }

  // ── OPTIMUS V2 (N1): activateAndStabilize ──
  // Stesso pattern WA: salva tab attivo, attiva LI, attende DOM stabile (msg-overlay,
  // msg-conversations-container, main, ecc.) e ritorna restore().
  async function activateAndStabilize(tabId, maxWaitMs) {
    let previousTabId = null;
    try {
      const tab = await chrome.tabs.get(tabId);
      const windowTabs = await chrome.tabs.query({ windowId: tab.windowId, active: true });
      if (windowTabs && windowTabs[0]) previousTabId = windowTabs[0].id;
    } catch (err) { console.debug("[LI Tab] N1 save prev:", err?.message); }

    try { await chrome.tabs.update(tabId, { active: true }); }
    catch (err) { console.debug("[LI Tab] N1 activate:", err?.message); }

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
              visible: document.visibilityState === "visible",
              hasContent: !!(
                document.querySelector('[class*="msg-conversations"]') ||
                document.querySelector('[class*="msg-overlay"]') ||
                document.querySelector('main') ||
                document.querySelector('[role="main"]')
              ),
              loading: !!document.querySelector('[class*="loading"]'),
            };
          },
        });
        const r = check && check[0] && check[0].result;
        if (r && r.ready && r.visible && r.hasContent) { stable = true; break; }
      } catch (err) { console.debug("[LI Tab] N1 probe:", err?.message); }
      await sleep(300);
    }

    if (stable) await sleep(500);

    return {
      stable: stable,
      previousTabId: previousTabId,
      restore: async function () {
        if (previousTabId && previousTabId !== tabId) {
          try { await chrome.tabs.update(previousTabId, { active: true }); }
          catch (err) { console.debug("[LI Tab] N1 restore:", err?.message); }
        }
      },
    };
  }

  // ── STEALTH MODE v2 (M5) — DEPRECATED, kept for backward compat ──
  async function ensureTabVisibleAndWait(tabId, postActivateMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab) return false;
      if (tab.active === false) {
        let previousActiveTabId = null;
        try {
          const windowTabs = await chrome.tabs.query({ windowId: tab.windowId, active: true });
          if (windowTabs && windowTabs[0]) previousActiveTabId = windowTabs[0].id;
        } catch (err) { console.debug("[LI Tab] M5 save prev:", err?.message); }

        try { await chrome.tabs.update(tabId, { active: true }); } catch (err) { console.debug("[LI Tab] M5 activate:", err?.message); }
        await sleep(Math.min(postActivateMs || 600, 1500));

        if (previousActiveTabId && previousActiveTabId !== tabId) {
          try { await chrome.tabs.update(previousActiveTabId, { active: true }); } catch (err) { console.debug("[LI Tab] M5 restore:", err?.message); }
        }
      } else {
        await sleep(Math.min(postActivateMs || 600, 1500));
      }
      return true;
    } catch (err) { console.debug("[LI Tab] visible:", err?.message); return false; }
  }

  // ── Operation Queue with dual lanes ──
  let _sessionQueue = Promise.resolve();
  let _actionQueue = Promise.resolve();

  function enqueueSession(fn) {
    _sessionQueue = _sessionQueue.then(fn, fn);
    return _sessionQueue;
  }

  function enqueueAction(fn) {
    _actionQueue = _actionQueue.then(fn, fn);
    return _actionQueue;
  }

  // Generic enqueue (backward compat)
  function enqueue(fn) {
    return enqueueAction(fn);
  }

  return {
    safeCreate: safeCreate,
    safeRemove: safeRemove,
    waitForLoad: waitForLoad,
    getLinkedInTab: getLinkedInTab,
    getTabId: getTabId,
    activateAndStabilize: activateAndStabilize,
    ensureTabVisibleAndWait: ensureTabVisibleAndWait,
    enqueueSession: enqueueSession,
    enqueueAction: enqueueAction,
    enqueue: enqueue,
    sleep: sleep,
  };
})();
globalThis.TabManager = TabManager;
