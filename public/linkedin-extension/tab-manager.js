// ══════════════════════════════════════════════════
// LinkedIn Extension v3.9 — Tab Manager Module
// AUTOMATION WINDOW ISOLATION (no focus stealing)
// ══════════════════════════════════════════════════

var TabManager = globalThis.TabManager || (function () {
  let _liTabId = null;
  let _automationWindowId = null;
  let _ownedTabIds = new Set();

  // ── Persistence (service worker may restart) ──
  async function loadOwnership() {
    try {
      const data = await chrome.storage.session.get([
        "li_automation_window", "li_owned_tabs", "li_main_tab",
      ]);
      if (data.li_automation_window) _automationWindowId = data.li_automation_window;
      if (Array.isArray(data.li_owned_tabs)) _ownedTabIds = new Set(data.li_owned_tabs);
      if (data.li_main_tab) _liTabId = data.li_main_tab;
    } catch (e) { /* ignore */ }
  }

  async function saveOwnership() {
    try {
      await chrome.storage.session.set({
        li_automation_window: _automationWindowId,
        li_owned_tabs: Array.from(_ownedTabIds),
        li_main_tab: _liTabId,
      });
    } catch (e) { /* ignore */ }
  }

  function markOwned(tabId) {
    _ownedTabIds.add(tabId);
    saveOwnership();
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // ── Get or create the dedicated AUTOMATION WINDOW (non-focused) ──
  async function getOrCreateAutomationWindow() {
    await loadOwnership();
    if (_automationWindowId !== null) {
      try {
        const win = await chrome.windows.get(_automationWindowId);
        if (win) return _automationWindowId;
      } catch (e) {
        _automationWindowId = null;
      }
    }
    try {
      const win = await chrome.windows.create({
        url: "about:blank",
        focused: false,
        state: "minimized",
        type: "normal",
      });
      _automationWindowId = win.id;
      // Force user window back to focus (some platforms ignore focused:false)
      try {
        const allWins = await chrome.windows.getAll();
        const userWin = allWins.find(function (w) { return w.id !== win.id && w.type === "normal"; });
        if (userWin) await chrome.windows.update(userWin.id, { focused: true });
      } catch (e) { /* ignore */ }
      try {
        if (win.tabs && win.tabs[0]) markOwned(win.tabs[0].id);
      } catch (e) { /* ignore */ }
      await saveOwnership();
      return _automationWindowId;
    } catch (e) {
      console.warn("[LI TabMgr] Failed to create automation window:", e?.message);
      _automationWindowId = null;
      return null;
    }
  }

  // ── Move tab into automation window (silent, no focus change) ──
  async function ensureTabInAutomationWindow(tabId) {
    try {
      const winId = await getOrCreateAutomationWindow();
      if (winId === null) return false;
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId === winId) return true;
      await chrome.tabs.move(tabId, { windowId: winId, index: -1 });
      return true;
    } catch (e) {
      console.debug("[LI TabMgr] ensureTabInAutomationWindow:", e?.message);
      return false;
    }
  }

  // ── Retry-safe tab creation IN AUTOMATION WINDOW ──
  async function safeCreate(options, maxRetries) {
    maxRetries = maxRetries || 3;
    const winId = await getOrCreateAutomationWindow();
    const opts = Object.assign({ active: false }, options || {});
    if (winId !== null) opts.windowId = winId;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const tab = await chrome.tabs.create(opts);
        markOwned(tab.id);
        return tab;
      } catch (err) {
        if (attempt < maxRetries - 1 && /cannot be edited/i.test(err.message)) {
          await sleep(500 * (attempt + 1));
        } else {
          // Last resort: create without windowId
          const tab = await chrome.tabs.create({ url: opts.url, active: false });
          markOwned(tab.id);
          return tab;
        }
      }
    }
  }

  function safeRemove(tabId) {
    if (tabId === _liTabId) return Promise.resolve();
    _ownedTabIds.delete(tabId);
    saveOwnership();
    return chrome.tabs.remove(tabId).catch(function () {});
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

  function urlMatchesTarget(tabUrl, targetUrl) {
    if (!tabUrl || !targetUrl) return false;
    try {
      const current = new URL(tabUrl);
      const target = new URL(targetUrl);
      const currentPath = current.pathname.replace(/\/$/, "");
      const targetPath = target.pathname.replace(/\/$/, "");
      return current.hostname === target.hostname && currentPath === targetPath;
    } catch (err) { console.debug("[LI Tab]", err?.message); return false; }
  }

  // ── getLinkedInTab: only reuses OWNED tabs, never user tabs ──
  async function getLinkedInTab(url, skipNavigateIfSameDomain) {
    await loadOwnership();

    // Try cached owned main tab
    if (_liTabId !== null) {
      try {
        const existing = await chrome.tabs.get(_liTabId);
        if (existing) {
          // Make sure it's still in our automation window
          await ensureTabInAutomationWindow(_liTabId);
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

    // Service worker MV3 may have restarted: look for an OWNED LinkedIn tab
    // (NEVER reuse user-opened tabs — that would steal them).
    try {
      const winId = await getOrCreateAutomationWindow();
      if (winId !== null) {
        const tabsInWin = await chrome.tabs.query({
          windowId: winId,
          url: "*://*.linkedin.com/*",
        });
        if (tabsInWin && tabsInWin[0]) {
          _liTabId = tabsInWin[0].id;
          markOwned(_liTabId);
          console.log("[LI Tab] Reused owned tab #" + _liTabId);
          if (skipNavigateIfSameDomain && tabsInWin[0].url && urlMatchesTarget(tabsInWin[0].url, url)) {
            if (tabsInWin[0].status !== "complete") await waitForLoad(_liTabId, 15000);
            return { id: _liTabId, reused: true };
          }
          await chrome.tabs.update(_liTabId, { url: url });
          await waitForLoad(_liTabId, 20000);
          return { id: _liTabId, reused: false };
        }
      }
    } catch (queryErr) {
      console.debug("[LI Tab] query owned tabs failed:", queryErr?.message);
    }

    // Create new in automation window
    const tab = await safeCreate({ url: url, active: false });
    _liTabId = tab.id;
    saveOwnership();
    await waitForLoad(tab.id, 20000);
    return tab;
  }

  function getTabId() {
    return _liTabId;
  }

  // ── OPTIMUS V2.1 (FOCUS-SAFE): activateAndStabilize ──
  // Same contract as WA: NEVER activate a tab in the user's window.
  async function activateAndStabilize(tabId, maxWaitMs) {
    await ensureTabInAutomationWindow(tabId);

    let activatedInAutomation = false;
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId === _automationWindowId) {
        await chrome.tabs.update(tabId, { active: true });
        activatedInAutomation = true;
      } else {
        console.warn("[LI TabMgr] Tab " + tabId + " not in automation window — skipping activate");
      }
    } catch (err) { console.debug("[LI Tab] V2.1 activate:", err?.message); }

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
        // visibilityState NOT required (minimized automation window)
        if (r && r.ready && r.hasContent) { stable = true; break; }
      } catch (err) { console.debug("[LI Tab] V2.1 probe:", err?.message); }
      await sleep(300);
    }
    if (stable) await sleep(500);

    return {
      stable: stable,
      previousTabId: null,
      activatedInAutomation: activatedInAutomation,
      restore: async function () { return; },
    };
  }

  // ── DEPRECATED shim — now focus-safe ──
  async function ensureTabVisibleAndWait(tabId, postActivateMs) {
    const res = await activateAndStabilize(tabId, Math.max(postActivateMs || 600, 1500));
    return !!res.stable || !!res.activatedInAutomation;
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

  function enqueue(fn) {
    return enqueueAction(fn);
  }

  loadOwnership();

  return {
    safeCreate: safeCreate,
    safeRemove: safeRemove,
    waitForLoad: waitForLoad,
    getLinkedInTab: getLinkedInTab,
    getTabId: getTabId,
    getOrCreateAutomationWindow: getOrCreateAutomationWindow,
    ensureTabInAutomationWindow: ensureTabInAutomationWindow,
    activateAndStabilize: activateAndStabilize,
    ensureTabVisibleAndWait: ensureTabVisibleAndWait,
    enqueueSession: enqueueSession,
    enqueueAction: enqueueAction,
    enqueue: enqueue,
    sleep: sleep,
  };
})();
globalThis.TabManager = TabManager;
