// ══════════════════════════════════════════════════
// LinkedIn Extension — Tab Manager Module
// Centralizes tab lifecycle: create, reuse, navigate, wait
// Queue system with priority lanes
// ══════════════════════════════════════════════════

var TabManager = (function () {
  var _liTabId = null;

  // ── Retry-safe tab creation ──
  async function safeCreate(options, maxRetries) {
    maxRetries = maxRetries || 3;
    for (var attempt = 0; attempt < maxRetries; attempt++) {
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
      var timeout = setTimeout(function () {
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
      var current = new URL(tabUrl);
      var target = new URL(targetUrl);
      // Exact pathname match (e.g. /messaging/ vs /messaging/thread/xxx)
      var currentPath = current.pathname.replace(/\/$/, "");
      var targetPath = target.pathname.replace(/\/$/, "");
      return current.hostname === target.hostname && currentPath === targetPath;
    } catch (_) { return false; }
  }

  async function getLinkedInTab(url, skipNavigateIfSameDomain) {
    // Try reusing cached tab
    if (_liTabId !== null) {
      try {
        var existing = await chrome.tabs.get(_liTabId);
        if (existing) {
          if (skipNavigateIfSameDomain && existing.url && /linkedin\.com/i.test(existing.url) && urlMatchesTarget(existing.url, url)) {
            if (existing.status !== "complete") await waitForLoad(_liTabId, 15000);
            return { id: _liTabId, reused: true };
          }
          await chrome.tabs.update(_liTabId, { url: url });
          await waitForLoad(_liTabId, 20000);
          return { id: _liTabId, reused: false };
        }
      } catch (_) {
        _liTabId = null;
      }
    }

    // Try finding any existing LinkedIn tab
    try {
      var existingTabs = await chrome.tabs.query({ url: "https://*.linkedin.com/*" });
      if (existingTabs && existingTabs.length > 0) {
        _liTabId = existingTabs[0].id;
        if (skipNavigateIfSameDomain && urlMatchesTarget(existingTabs[0].url, url)) {
          if (existingTabs[0].status !== "complete") await waitForLoad(_liTabId, 15000);
          return { id: _liTabId, reused: true };
        }
        await chrome.tabs.update(_liTabId, { url: url });
        await waitForLoad(_liTabId, 20000);
        return { id: _liTabId, reused: false };
      }
    } catch (_) {}

    // Create new tab
    var tab = await safeCreate({ url: url, active: false });
    _liTabId = tab.id;
    await waitForLoad(tab.id, 20000);
    return tab;
  }

  function getTabId() {
    return _liTabId;
  }

  // ── Operation Queue with dual lanes ──
  var _sessionQueue = Promise.resolve();
  var _actionQueue = Promise.resolve();

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
    enqueueSession: enqueueSession,
    enqueueAction: enqueueAction,
    enqueue: enqueue,
    sleep: sleep,
  };
})();
