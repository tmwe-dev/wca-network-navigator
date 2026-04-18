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

    // Create a dedicated background tab for the extension.
    // Do not hijack user-opened LinkedIn tabs.
    const tab = await safeCreate({ url: url, active: false });
    _liTabId = tab.id;
    await waitForLoad(tab.id, 20000);
    return tab;
  }

  function getTabId() {
    return _liTabId;
  }

  // ── Ensure tab is active+focused so DOM rendering resumes (no restore) ──
  async function ensureTabVisibleAndWait(tabId, postActivateMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab) return false;
      let activated = false;
      if (!tab.active) {
        try { await chrome.tabs.update(tabId, { active: true }); activated = true; } catch (err) { console.debug("[LI Tab] update:", err?.message); }
      }
      if (typeof tab.windowId === "number") {
        try { await chrome.windows.update(tab.windowId, { focused: true }); } catch (err) { console.debug("[LI Tab] focus:", err?.message); }
      }
      if (activated) await sleep(postActivateMs || 1200);
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
    ensureTabVisibleAndWait: ensureTabVisibleAndWait,
    enqueueSession: enqueueSession,
    enqueueAction: enqueueAction,
    enqueue: enqueue,
    sleep: sleep,
  };
})();
globalThis.TabManager = TabManager;
