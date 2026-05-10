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
      // Defensive cleanup: drop owned tabs that aren't LinkedIn anymore
      try {
        const ids = Array.from(_ownedTabIds);
        for (const tid of ids) {
          try {
            const t = await chrome.tabs.get(tid);
            const u = t && (t.pendingUrl || t.url) || "";
            if (!/linkedin\.com/i.test(u)) _ownedTabIds.delete(tid);
          } catch { _ownedTabIds.delete(tid); }
        }
        if (_liTabId !== null) {
          try {
            const t = await chrome.tabs.get(_liTabId);
            const u = t && (t.pendingUrl || t.url) || "";
            if (!/linkedin\.com/i.test(u)) _liTabId = null;
          } catch { _liTabId = null; }
        }
      } catch { /* ignore */ }
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

  // ── Legacy automation window API ──
  // Disabled: creating a separate window can spawn a blank placeholder tab and
  // closes the extension popup. New tabs are now created as inactive tabs in
  // the current browser window, after reusing any existing LinkedIn tab.
  async function getOrCreateAutomationWindow(initialUrl) {
    await loadOwnership();
    try {
      _automationWindowId = null;
      await chrome.storage.session.remove(["li_automation_window"]);
      await saveOwnership();
    } catch (e) {
      _automationWindowId = null;
    }
    return null;
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
    await loadOwnership();
    _automationWindowId = null;
    const opts = Object.assign({ active: false }, options || {});
    delete opts.windowId;
    // Reuse any existing LinkedIn tab before opening a new inactive tab.
    try {
      if (opts.url) {
        const existing = await chrome.tabs.query({ url: "*://*.linkedin.com/*" });
        if (existing && existing[0]) {
          markOwned(existing[0].id);
          return existing[0];
        }
      }
    } catch (e) { /* ignore */ }
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const tab = await chrome.tabs.create(opts);
        markOwned(tab.id);
        return tab;
      } catch (err) {
        if (attempt < maxRetries - 1 && /cannot be edited/i.test(err.message)) {
          await sleep(500 * (attempt + 1));
        } else {
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
  async function getLinkedInTab(url, skipNavigateIfSameDomain, allowCreate) {
    await loadOwnership();
    const canCreate = allowCreate !== false;

    // 3.9.54 — Preferenza esatta: se url target valorizzato, cerchiamo
    // PRIMA una tab LinkedIn con path identico, prima di adottare una
    // tab generica. Evita di dirottare l'utente su un profilo diverso.
    if (url) {
      try {
        const allLi = await chrome.tabs.query({ url: "*://*.linkedin.com/*" });
        const exact = (allLi || []).find(function (t) {
          return t.windowId !== _automationWindowId && urlMatchesTarget(t.url, url);
        });
        if (exact) {
          _liTabId = exact.id;
          markOwned(_liTabId);
          console.log("[LI Tab] Reusing exact-match LinkedIn tab #" + _liTabId);
          if (exact.status !== "complete") await waitForLoad(_liTabId, 15000);
          return { id: _liTabId, reused: true, exactMatch: true };
        }
      } catch (e) { /* ignore */ }
    }

    // Always prefer a LinkedIn tab already open outside the automation window.
    // P14: if the caller says same-domain reuse is allowed, keep the user on
    // the current LinkedIn page instead of navigating away.
    try {
      const userTabs = await chrome.tabs.query({ url: "*://*.linkedin.com/*" });
      const userTab = userTabs && userTabs.find(function (t) { return t.windowId !== _automationWindowId; });
      if (userTab) {
        _liTabId = userTab.id;
        markOwned(_liTabId);
        console.log("[LI Tab] Reusing existing user LinkedIn tab #" + _liTabId);
        if (skipNavigateIfSameDomain && userTab.url && /linkedin\.com/i.test(userTab.url)) {
          if (userTab.status !== "complete") await waitForLoad(_liTabId, 15000);
          return { id: _liTabId, reused: true };
        }
        await chrome.tabs.update(_liTabId, { url: url });
        await waitForLoad(_liTabId, 20000);
        return { id: _liTabId, reused: false };
      }
    } catch (e) { /* ignore */ }

    // Try cached owned main tab
    if (_liTabId !== null) {
      try {
        const existing = await chrome.tabs.get(_liTabId);
        if (existing) {
          // NB: do NOT force-move the tab to the automation window.
          // If the user has LinkedIn open in their own window we want to reuse
          // it in place — moving it creates the perception of a "new tab"
          // appearing somewhere else and steals the user's tab.
          if (skipNavigateIfSameDomain && existing.url && /linkedin\.com/i.test(existing.url)) {
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

    // Prefer reusing a LinkedIn tab the user already has open — this avoids
    // spawning a new automation window when one is not needed and matches
    // the user expectation ("usa la pagina che è già aperta").
    try {
      const userTabs = await chrome.tabs.query({ url: "*://*.linkedin.com/*" });
      if (userTabs && userTabs[0]) {
        _liTabId = userTabs[0].id;
        markOwned(_liTabId);
        console.log("[LI Tab] Adopted existing LinkedIn tab #" + _liTabId);
        if (skipNavigateIfSameDomain && userTabs[0].url && /linkedin\.com/i.test(userTabs[0].url)) {
          if (userTabs[0].status !== "complete") await waitForLoad(_liTabId, 15000);
          return { id: _liTabId, reused: true };
        }
        await chrome.tabs.update(_liTabId, { url: url });
        await waitForLoad(_liTabId, 20000);
        return { id: _liTabId, reused: false };
      }
    } catch (e) { /* ignore */ }

    // Service worker may have restarted: also check an already-known
    // automation window, but DO NOT create one just to query it.
    try {
      if (_automationWindowId !== null) {
        const win = await chrome.windows.get(_automationWindowId).catch(function () { return null; });
        if (win) {
        const tabsInWin = await chrome.tabs.query({
          windowId: _automationWindowId,
          url: "*://*.linkedin.com/*",
        });
        if (tabsInWin && tabsInWin[0]) {
          _liTabId = tabsInWin[0].id;
          markOwned(_liTabId);
          console.log("[LI Tab] Reused owned tab #" + _liTabId);
          if (skipNavigateIfSameDomain && tabsInWin[0].url && /linkedin\.com/i.test(tabsInWin[0].url)) {
            if (tabsInWin[0].status !== "complete") await waitForLoad(_liTabId, 15000);
            return { id: _liTabId, reused: true };
          }
          await chrome.tabs.update(_liTabId, { url: url });
          await waitForLoad(_liTabId, 20000);
          return { id: _liTabId, reused: false };
        }
        }
      }
    } catch (queryErr) {
      console.debug("[LI Tab] query owned tabs failed:", queryErr?.message);
    }

    if (!canCreate) {
      console.warn("[LI Tab] No existing LinkedIn tab and creation disabled for this action");
      return null;
    }

    // Create new inactive tab only for explicit non-send actions
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
    // Do NOT create/move tabs just to stabilize. If the user already has
    // LinkedIn open, keep that tab exactly where it is and probe DOM as-is.
    await loadOwnership();

    let activatedInAutomation = false;
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId === _automationWindowId) activatedInAutomation = false;
      console.warn("[LI TabMgr] Focus-safe mode — never activating LinkedIn tab during automation");
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
