// ══════════════════════════════════════════════
// WhatsApp Extension - Background Service Worker v4.2
// Self-Healing DOM: zero hardcoded selectors
// Discovery chain: Learned → Structural → AI
// ══════════════════════════════════════════════

const WA_BASE = "https://web.whatsapp.com";
const SCHEMA_TTL_MS = 3 * 60 * 60 * 1000; // 3h cache

const APP_URL_PATTERNS = [
  /^https:\/\/[^/]*\.lovable\.app\//i,
  /^https:\/\/[^/]*\.lovableproject\.com\//i,
  /^https?:\/\/localhost(?::\d+)?\//i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?\//i,
];

function isAppUrl(url) {
  return typeof url === "string" && APP_URL_PATTERNS.some(function(p) { return p.test(url); });
}

// ── Cached learned selectors ──
var cachedSchema = null;
var schemaLearnedAt = 0;

async function loadSchema() {
  try {
    var data = await chrome.storage.local.get(["waSchema", "waSchemaAt"]);
    if (data.waSchema && data.waSchemaAt) {
      cachedSchema = data.waSchema;
      schemaLearnedAt = data.waSchemaAt;
    }
  } catch (_) {}
  return cachedSchema;
}

async function saveSchema(schema) {
  cachedSchema = schema;
  schemaLearnedAt = Date.now();
  try {
    await chrome.storage.local.set({ waSchema: schema, waSchemaAt: schemaLearnedAt });
  } catch (_) {}
}

function isSchemaStale() {
  return !cachedSchema || (Date.now() - schemaLearnedAt > SCHEMA_TTL_MS);
}

// ── Bridge injection ──
async function injectBridgeIntoFrame(tabId, frameId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [frameId] },
      files: ["content.js"],
    });
    return true;
  } catch (error) {
    var msg = error?.message || "";
    if (msg.includes("Cannot access") || msg.includes("Missing host") || msg.includes("No frame") || msg.includes("Frame with ID") || msg.includes("gallery")) return false;
    return false;
  }
}

async function injectBridgeIntoTab(tabId) {
  try {
    var frames = await chrome.webNavigation.getAllFrames({ tabId: tabId });
    if (!frames?.length) return false;
    var injected = false;
    for (var f of frames) {
      if (!isAppUrl(f.url)) continue;
      var ok = await injectBridgeIntoFrame(tabId, f.frameId);
      injected = ok || injected;
    }
    return injected;
  } catch (_) { return false; }
}

async function syncBridgeAcrossOpenTabs() {
  try {
    var tabs = await chrome.tabs.query({});
    for (var t of tabs) {
      if (typeof t.id !== "number") continue;
      await injectBridgeIntoTab(t.id);
    }
  } catch (_) {}
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function safeCreateTab(url, active) {
  for (var i = 0; i < 3; i++) {
    try { return await chrome.tabs.create({ url: url, active: active || false }); }
    catch (e) { if (i < 2) await sleep(500 * (i + 1)); else throw e; }
  }
}

async function safeRemoveTab(tabId) {
  try { await chrome.tabs.remove(tabId); } catch (_) {}
}

async function waitForLoad(tabId, timeoutMs) {
  var start = Date.now();
  while (Date.now() - start < (timeoutMs || 30000)) {
    try {
      var tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") return true;
    } catch (_) { return false; }
    await sleep(500);
  }
  return false;
}

function sortTabsByFreshness(tabs) {
  return (tabs || []).slice().sort(function(a, b) {
    var aScore = (a.active ? 1000 : 0) + (a.status === "complete" ? 100 : 0);
    var bScore = (b.active ? 1000 : 0) + (b.status === "complete" ? 100 : 0);
    if (bScore !== aScore) return bScore - aScore;
    return Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0);
  });
}

async function getBestExistingWaTab() {
  try {
    var tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    return sortTabsByFreshness(tabs)[0] || null;
  } catch (_) {
    return null;
  }
}

async function getLastFocusedActiveTab() {
  try {
    var tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tabs?.[0] || null;
  } catch (_) {
    return null;
  }
}

async function activateTabTemporarily(tabId) {
  try {
    var previous = await getLastFocusedActiveTab();
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
  try {
    await chrome.tabs.update(ctx.tabId, { active: true });
  } catch (_) {}
}

async function withTemporarilyVisibleTab(tabId, fn) {
  var restoreCtx = await activateTabTemporarily(tabId);
  try {
    return await fn();
  } finally {
    await restoreTabContext(restoreCtx);
  }
}

// ── Persistent WA tab ──
async function getOrCreateWaTab() {
  try {
    var existing = await getBestExistingWaTab();
    if (existing) {
      if (existing.status !== "complete") await waitForLoad(existing.id, 15000);
      return { tab: existing, reused: true };
    }
  } catch (_) {}
  var tab = await safeCreateTab(WA_BASE, false);
  var loaded = await waitForLoad(tab.id, 30000);
  if (!loaded) throw new Error("WhatsApp Web non caricato");
  await sleep(4000);
  return { tab: tab, reused: false };
}

// ── Config ──
async function getConfig() {
  try {
    var data = await chrome.storage.local.get(["supabaseUrl", "anonKey", "authToken"]);
    return data;
  } catch (_) { return {}; }
}

// ── Call AI edge function ──
async function callAiExtract(html, mode, supabaseUrl, anonKey, authToken) {
  try {
    var url = supabaseUrl + "/functions/v1/whatsapp-ai-extract";
    var headers = { "Content-Type": "application/json", "apikey": anonKey };
    headers["Authorization"] = "Bearer " + (authToken || anonKey);
    var resp = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ html: html, mode: mode }),
    });
    if (!resp.ok) { console.warn("[WA AI] Edge error:", resp.status); return null; }
    return await resp.json();
  } catch (e) {
    console.warn("[WA AI] Fetch failed:", e.message);
    return null;
  }
}

// ══════════════════════════════════════════════
// DISCOVERY ENGINE — finds elements without hardcoded selectors
// ══════════════════════════════════════════════

// Multi-strategy element discovery
function buildDiscoveryScript() {
  return function() {
    function scanShadowRoots(root, roots, seen) {
      try {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        while (walker.nextNode()) {
          var el = walker.currentNode;
          if (el && el.shadowRoot && !seen.has(el.shadowRoot)) {
            seen.add(el.shadowRoot);
            roots.push(el.shadowRoot);
            scanShadowRoots(el.shadowRoot, roots, seen);
          }
        }
      } catch (_) {}
    }
    var searchRootsCache = null;
    function getSearchRoots() {
      if (searchRootsCache) return searchRootsCache;
      var roots = [document];
      var seen = new Set([document]);
      scanShadowRoots(document, roots, seen);
      searchRootsCache = roots;
      return roots;
    }
    function qsaDeep(sel) {
      var out = [];
      var seen = new Set();
      for (var root of getSearchRoots()) {
        try {
          root.querySelectorAll(sel).forEach(function(el) {
            if (!seen.has(el)) {
              seen.add(el);
              out.push(el);
            }
          });
        } catch (_) {}
      }
      return out;
    }
    function qsDeep(sel) {
      var els = qsaDeep(sel);
      return els[0] || null;
    }
    function filterVisible(els) {
      return Array.from(els || []).filter(function(el) {
        try {
          var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
          return !rect || rect.width > 0 || rect.height > 0;
        } catch (_) {
          return true;
        }
      });
    }
    function byTestId(id) { return qsDeep('[data-testid="' + id + '"]'); }
    function byRole(role, namePattern) {
      var els = qsaDeep('[role="' + role + '"]');
      if (!namePattern) return els[0] || null;
      for (var e of els) {
        var label = (e.getAttribute("aria-label") || "").toLowerCase();
        if (label.includes(namePattern.toLowerCase())) return e;
      }
      return null;
    }
    function byStructure(selectors) {
      for (var s of selectors) {
        var el = qsDeep(s);
        if (el) return el;
      }
      return null;
    }

    var result = {
      url: location.href,
      title: document.title,
      isWhatsApp: location.hostname === "web.whatsapp.com",
      visibilityState: document.visibilityState || null,
      hidden: !!document.hidden,
      shadowRootCount: Math.max(0, getSearchRoots().length - 1),
    };

    // ── QR detection (login check) ──
    result.hasQR = !!(
      byTestId("qrcode") ||
      document.querySelector('canvas[aria-label*="QR"]') ||
      document.querySelector('canvas[aria-label*="qr"]') ||
      document.querySelector('[data-ref]') // QR container
    );

    // ── Sidebar discovery ──
    result.sidebar = null;
    result.sidebarSelector = null;
    var sidebarCandidates = [
      { sel: '#pane-side', name: 'pane-side' },
      { sel: '#side', name: 'side' },
      { sel: '[data-testid="chatlist"]', name: 'chatlist-testid' },
      { sel: '[data-testid="chat-list"]', name: 'chat-list-testid' },
      { sel: '[aria-label*="chat list" i]', name: 'aria-chatlist' },
      { sel: '[aria-label*="elenco chat" i]', name: 'aria-elenco' },
      { sel: 'nav [role="list"]', name: 'nav-list' },
      { sel: '[role="navigation"]', name: 'role-nav' },
    ];
    for (var c of sidebarCandidates) {
      var el = qsDeep(c.sel);
      if (el && ((el.children && el.children.length > 0) || (el.textContent || "").trim().length > 0)) {
        result.sidebar = true;
        result.sidebarSelector = c.name;
        result.sidebarChildCount = el.children.length;
        break;
      }
    }

    // ── Chat items discovery ──
    result.chatItems = 0;
    result.chatItemsMethod = null;
    var chatItemStrategies = [
      { sel: '[data-testid="cell-frame-container"]', name: 'cell-frame' },
      { sel: '[data-testid="chat-cell-wrapper"]', name: 'cell-wrapper' },
      { sel: '[data-testid="list-item"]', name: 'list-item' },
      { sel: '[role="listitem"]', name: 'role-listitem' },
      { sel: '[role="row"]', name: 'role-row' },
      { sel: '[tabindex="-1"][role="row"]', name: 'tabindex-row' },
    ];
    // Also try within discovered sidebar
    for (var s of chatItemStrategies) {
      var items = filterVisible(qsaDeep(s.sel));
      if (items.length > 0) {
        result.chatItems = items.length;
        result.chatItemsMethod = s.name;
        break;
      }
    }

    // If no items found, try broader discovery
    if (result.chatItems === 0) {
      // Look for any scrollable container with multiple similar children
      var containers = filterVisible(qsaDeep('[role="list"], [role="listbox"], [role="grid"]'));
      for (var cont of containers) {
        var visibleChildren = filterVisible(Array.from(cont.children || []));
        if (visibleChildren.length >= 3) {
          result.chatItems = visibleChildren.length;
          result.chatItemsMethod = 'role-container-children';
          result.discoveredContainerRole = cont.getAttribute("role");
          break;
        }
      }
    }

    // ── Deep structural discovery if still nothing ──
    if (result.chatItems === 0 && !result.hasQR) {
      // Walk DOM looking for repeating structures with titles
      var allSpansWithTitle = filterVisible(qsaDeep('span[title]'));
      var parentCounts = new Map();
      for (var sp of allSpansWithTitle) {
        var p = sp.parentElement?.parentElement?.parentElement;
        if (p) {
          var key = p.tagName + '.' + (p.className || '').split(' ')[0];
          parentCounts.set(key, (parentCounts.get(key) || 0) + 1);
        }
      }
      var bestKey = null, bestCount = 0;
      for (var [k, v] of parentCounts) {
        if (v > bestCount) { bestCount = v; bestKey = k; }
      }
      if (bestCount >= 3) {
        result.chatItems = bestCount;
        result.chatItemsMethod = 'span-title-heuristic';
        result.heuristicPattern = bestKey;
      }
    }

    // ── Compose box detection ──
    result.hasComposeBox = !!(
      byTestId("conversation-compose-box-input") ||
      qsDeep('#main [contenteditable="true"]') ||
      qsDeep('[role="textbox"][contenteditable="true"]') ||
      qsDeep('[data-testid="compose-box"]')
    );
    result.textboxCount = qsaDeep('[role="textbox"], [contenteditable="true"]').length;

    // ── Loading/auth shell markers ──
    result.hasLoadingScreen = !!(
      qsDeep('[data-testid="intro-md-beta-logo"]') ||
      qsDeep('.landing-window') ||
      qsDeep('[data-testid="startup"]')
    );
    result.hasServiceWorker = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    result.storageMarkers = [];
    try {
      var storageKeys = Object.keys(window.localStorage || {});
      var authMarkerPatterns = ['last-wid', 'last-wid-md', 'remember-me', 'rememberme', 'md-opted-in'];
      result.storageMarkers = storageKeys.filter(function(key) {
        var lower = String(key || '').toLowerCase();
        return authMarkerPatterns.some(function(marker) { return lower.indexOf(marker) !== -1; });
      }).slice(0, 12);
    } catch (_) {}

    // ── App loaded check ──
    result.appLoaded = !!(
      qsDeep('#app') ||
      qsDeep('[id="app"]')
    );
    result.bodyChildCount = document.body ? document.body.children.length : 0;

    // ── Sample first chat HTML for AI learning ──
    if (result.chatItems > 0 && result.chatItemsMethod) {
      try {
        var firstItem;
        if (result.chatItemsMethod === 'role-container-children') {
          var cont = qsDeep('[role="list"], [role="listbox"], [role="grid"]');
          firstItem = cont?.children[0];
        } else if (result.chatItemsMethod === 'span-title-heuristic') {
          firstItem = qsDeep('span[title]')?.closest('[tabindex]') ||
            qsDeep('span[title]')?.parentElement?.parentElement;
        } else {
          var selectorMap = {
            'cell-frame': '[data-testid="cell-frame-container"]',
            'cell-wrapper': '[data-testid="chat-cell-wrapper"]',
            'list-item': '[data-testid="list-item"]',
            'role-listitem': '[role="listitem"]',
            'role-row': '[role="row"]',
            'tabindex-row': '[tabindex="-1"][role="row"]',
          };
          firstItem = qsDeep(selectorMap[result.chatItemsMethod]);
        }
        if (firstItem) {
          result.firstChatHTML = firstItem.outerHTML.slice(0, 2000);
          var titleEl = firstItem.querySelector('span[title]');
          result.firstTitle = titleEl ? titleEl.getAttribute("title") : null;
        }
      } catch (_) {}
    }

    // ── Collect data-testid inventory ──
    var testIds = new Set();
    qsaDeep('[data-testid]').forEach(function(e) {
      testIds.add(e.getAttribute('data-testid'));
    });
    result.dataTestIds = Array.from(testIds).slice(0, 80);

    return result;
  };
}

async function runDiscoveryScript(tabId) {
  var results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: buildDiscoveryScript(),
  });
  return results?.[0]?.result || null;
}

function hasRenderableWaUi(result) {
  if (!result) return false;
  if (result.sidebar) return true;
  if ((result.chatItems || 0) > 0) return true;
  if (result.hasComposeBox || (result.textboxCount || 0) > 0) return true;
  return Array.isArray(result.dataTestIds) && result.dataTestIds.length >= 6;
}

function hasShellSignals(result) {
  if (!result) return false;
  return (
    Array.isArray(result.dataTestIds) && result.dataTestIds.length >= 12 && result.bodyChildCount >= 10
  ) || (
    result.hasServiceWorker && result.bodyChildCount >= 10
  ) || (
    Array.isArray(result.storageMarkers) && result.storageMarkers.length > 0 && result.bodyChildCount >= 8
  );
}

async function waitForRenderableWaUi(tabId, maxAttempts, delayPlan) {
  var lastResult = null;
  for (var attempt = 0; attempt < (maxAttempts || 1); attempt++) {
    if (attempt > 0) {
      var delay = Array.isArray(delayPlan)
        ? (delayPlan[Math.min(attempt - 1, delayPlan.length - 1)] || 1200)
        : (delayPlan || 1200);
      await sleep(delay);
    }
    try {
      lastResult = await runDiscoveryScript(tabId);
      if (lastResult && (lastResult.hasQR || hasRenderableWaUi(lastResult))) {
        return lastResult;
      }
    } catch (_) {}
  }
  return lastResult;
}

// ══════════════════════════════════════════════
// VERIFY SESSION — discovery-based
// ══════════════════════════════════════════════
function compactDiscovery(result) {
  if (!result) return null;
  return {
    url: result.url || null,
    title: result.title || null,
    hasQR: !!result.hasQR,
    hasLoadingScreen: !!result.hasLoadingScreen,
    sidebar: !!result.sidebar,
    sidebarSelector: result.sidebarSelector || null,
    chatItems: Number(result.chatItems || 0),
    chatItemsMethod: result.chatItemsMethod || null,
    hasComposeBox: !!result.hasComposeBox,
    textboxCount: Number(result.textboxCount || 0),
    appLoaded: !!result.appLoaded,
    bodyChildCount: Number(result.bodyChildCount || 0),
    dataTestIdsCount: Array.isArray(result.dataTestIds) ? result.dataTestIds.length : 0,
    storageMarkers: Array.isArray(result.storageMarkers) ? result.storageMarkers : [],
    hasServiceWorker: !!result.hasServiceWorker,
    visibilityState: result.visibilityState || null,
    hidden: !!result.hidden,
    shadowRootCount: Number(result.shadowRootCount || 0),
  };
}

async function verifySession() {
  try {
    var existing = await getBestExistingWaTab();
    var waTab;
    if (existing) {
      waTab = existing;
      if (waTab.status !== "complete") await waitForLoad(waTab.id, 8000);
    } else {
      var r = await getOrCreateWaTab();
      waTab = r.tab;
      await sleep(3000);
    }

    var result = await waitForRenderableWaUi(waTab.id, 3, [1200, 1800]);
    var shouldHydrateVisible = !waTab.active && (!result || (!result.hasQR && !hasRenderableWaUi(result) && (hasShellSignals(result) || result.appLoaded)));

    if (shouldHydrateVisible) {
      result = await withTemporarilyVisibleTab(waTab.id, async function() {
        return await waitForRenderableWaUi(waTab.id, 4, [900, 1400, 2000]);
      }) || result;
    }

    var lastDiagnostic = compactDiscovery(result);
    if (result?.hasQR) {
      return { success: true, authenticated: false, reason: "qr_required", diagnostic: lastDiagnostic };
    }
    if (result && (result.hasLoadingScreen || !result.appLoaded || result.bodyChildCount < 3)) {
      return { success: true, authenticated: false, reason: "loading", diagnostic: lastDiagnostic };
    }
    if (result?.sidebar) {
      return { success: true, authenticated: true, method: "sidebar:" + (result.sidebarSelector || "discovered"), diagnostic: lastDiagnostic };
    }
    if ((result?.chatItems || 0) > 0) {
      return { success: true, authenticated: true, method: "chat-items:" + (result.chatItemsMethod || "discovered"), diagnostic: lastDiagnostic };
    }
    if (result?.hasComposeBox || (result?.textboxCount || 0) > 0) {
      return { success: true, authenticated: true, method: result.hasComposeBox ? "compose-box" : "textbox", diagnostic: lastDiagnostic };
    }
    if (hasShellSignals(result)) {
      return { success: true, authenticated: true, method: "app-shell-fallback", diagnostic: lastDiagnostic };
    }
    return { success: true, authenticated: false, reason: "unknown_state", diagnostic: lastDiagnostic };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ══════════════════════════════════════════════
// READ UNREAD — multi-strategy discovery
// ══════════════════════════════════════════════
async function readUnreadDOM(tabId) {
  // Load cached schema if available
  await loadSchema();

  var results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    args: [cachedSchema],
    func: function(schema) {
      var VERIFY_COUNT = 5;

      function scanShadowRoots(root, roots, seen) {
        try {
          var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
          while (walker.nextNode()) {
            var el = walker.currentNode;
            if (el && el.shadowRoot && !seen.has(el.shadowRoot)) {
              seen.add(el.shadowRoot);
              roots.push(el.shadowRoot);
              scanShadowRoots(el.shadowRoot, roots, seen);
            }
          }
        } catch (_) {}
      }
      var globalRoots = null;
      function getGlobalRoots() {
        if (globalRoots) return globalRoots;
        var roots = [document];
        var seen = new Set([document]);
        scanShadowRoots(document, roots, seen);
        globalRoots = roots;
        return roots;
      }
      function getNestedRoots(root) {
        var roots = [root];
        var seen = new Set([root]);
        scanShadowRoots(root, roots, seen);
        return roots;
      }
      function queryAllFromRoots(roots, sel) {
        var out = [];
        var seen = new Set();
        for (var root of roots) {
          try {
            root.querySelectorAll(sel).forEach(function(el) {
              if (!seen.has(el)) {
                seen.add(el);
                out.push(el);
              }
            });
          } catch (_) {}
        }
        return out;
      }
      function qsaDeep(sel) { return queryAllFromRoots(getGlobalRoots(), sel); }
      function qsDeep(sel) {
        var els = qsaDeep(sel);
        return els[0] || null;
      }
      function qsaWithin(root, sel) { return queryAllFromRoots(getNestedRoots(root), sel); }
      function qsWithin(root, sel) {
        var els = qsaWithin(root, sel);
        return els[0] || null;
      }
      function filterVisible(els) {
        return Array.from(els || []).filter(function(el) {
          try {
            var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
            return !rect || rect.width > 0 || rect.height > 0;
          } catch (_) {
            return true;
          }
        });
      }

      // QR check
      if (qsDeep('canvas[aria-label]') ||
          qsDeep('[data-testid="qrcode"]') ||
          qsDeep('[data-ref]'))
        return { success: false, error: "QR code visibile - accedi a WhatsApp Web" };

      // ── Find chat items using multiple strategies ──
      var chatItems = [];
      var method = "none";

      // Strategy 1: Use learned schema
      if (schema && schema.chatItem) {
        chatItems = filterVisible(qsaDeep(schema.chatItem));
        if (chatItems.length > 0) method = "learned:" + schema.chatItem;
      }
      if (chatItems.length === 0 && schema && schema.chatItemAlt) {
        chatItems = filterVisible(qsaDeep(schema.chatItemAlt));
        if (chatItems.length > 0) method = "learned-alt:" + schema.chatItemAlt;
      }

      // Strategy 2: data-testid patterns
      if (chatItems.length === 0) {
        var testIdPatterns = [
          'cell-frame-container', 'chat-cell-wrapper', 'list-item',
          'chatlist-item', 'chat-list-item',
        ];
        for (var tid of testIdPatterns) {
          chatItems = filterVisible(qsaDeep('[data-testid="' + tid + '"]'));
          if (chatItems.length > 0) { method = "testid:" + tid; break; }
        }
      }

      // Strategy 3: role-based
      if (chatItems.length === 0) {
        var rolePatterns = [
          { sel: '[role="listitem"]', name: 'listitem' },
          { sel: '[role="row"]', name: 'row' },
          { sel: '[role="option"]', name: 'option' },
        ];
        for (var rp of rolePatterns) {
          chatItems = filterVisible(qsaDeep(rp.sel));
          if (chatItems.length >= 3) { method = "role:" + rp.name; break; }
        }
      }

      // Strategy 4: Find container with many similar children
      if (chatItems.length === 0) {
        var containers = filterVisible(qsaDeep('[role="list"], [role="listbox"], [role="grid"], [role="navigation"]'));
        for (var cont of containers) {
          var visibleChildren = filterVisible(Array.from(cont.children || []));
          if (visibleChildren.length >= 3) {
            chatItems = visibleChildren;
            method = "container:" + cont.getAttribute("role");
            break;
          }
        }
      }

      // Strategy 5: Heuristic — find elements with span[title] inside
      if (chatItems.length === 0) {
        var allTitled = filterVisible(qsaDeep('span[title]'));
        var parentMap = new Map();
        for (var sp of allTitled) {
          // Walk up to find a clickable ancestor
          var ancestor = sp.closest('[tabindex], [role="row"], [role="listitem"], [data-testid]');
          if (ancestor && !parentMap.has(ancestor)) {
            parentMap.set(ancestor, true);
          }
        }
        if (parentMap.size >= 3) {
          chatItems = Array.from(parentMap.keys());
          method = "heuristic-titled-ancestors";
        }
      }

      if (chatItems.length === 0) {
        return { success: true, messages: [], scanned: 0, method: "none", error: "No chat items found" };
      }

      // ── Extract messages from found items ──
      var messages = [];
      var processed = 0;

      for (var i = 0; i < chatItems.length; i++) {
        var chat = chatItems[i];

        // Find unread badge - multi-strategy
        var badge = null;
        var count = 0;

        // Badge strategy 1: data-testid
        badge = qsWithin(chat, '[data-testid="icon-unread-count"]') ||
          qsWithin(chat, '[data-testid="unread-count"]');
        if (badge) { count = parseInt(badge.textContent) || 1; }

        // Badge strategy 2: aria-label
        if (!badge) {
          var ariaEls = qsaWithin(chat, 'span[aria-label]');
          for (var ae of ariaEls) {
            var label = (ae.getAttribute("aria-label") || "").toLowerCase();
            if (label.includes("unread") || label.includes("non lett") || label.includes("da leggere")) {
              count = parseInt(ae.textContent) || 1;
              badge = ae;
              break;
            }
          }
        }

        // Badge strategy 3: colored circle with number
        if (!badge) {
          var spans = qsaWithin(chat, 'span');
          for (var s of spans) {
            var txt = s.textContent.trim();
            if (txt && /^\d+$/.test(txt) && txt.length <= 4) {
              var bg = window.getComputedStyle(s).backgroundColor;
              var parentBg = s.parentElement ? window.getComputedStyle(s.parentElement).backgroundColor : "";
              if ((bg + parentBg).match(/37,\s*211|25d366|00a884|rgb\(0,\s*168|rgb\(37/i)) {
                count = parseInt(txt) || 1;
                badge = s;
                break;
              }
            }
          }
        }

        // Include first VERIFY_COUNT + all unread
        var isVerify = processed < VERIFY_COUNT;
        if (count === 0 && !isVerify) continue;

        // Find contact name - multi-strategy
        var contactName = "Sconosciuto";
        var titleEl = qsWithin(chat, 'span[title][dir="auto"]') ||
          qsWithin(chat, 'span[title]') ||
          qsWithin(chat, '[data-testid="cell-frame-title"] span');
        if (titleEl) {
          contactName = titleEl.getAttribute("title") || titleEl.textContent?.trim() || "Sconosciuto";
        }

        // Find last message preview
        var lastMessage = "";
        var msgEl = qsWithin(chat, '[data-testid="last-msg-status"]') ||
          qsWithin(chat, '[data-testid="cell-frame-secondary"] span[title]') ||
          qsWithin(chat, '[data-testid="cell-frame-secondary"] span') ||
          qsWithin(chat, '[data-testid="last-msg"] span');
        if (!msgEl) {
          // Heuristic: second span[title] or last span with substantial text
          var allSpans = qsaWithin(chat, 'span');
          var candidates = [];
          for (var sp2 of allSpans) {
            var t = sp2.textContent?.trim();
            if (t && t.length > 3 && t !== contactName && !/^\d+$/.test(t)) {
              candidates.push(sp2);
            }
          }
          if (candidates.length > 0) msgEl = candidates[candidates.length - 1];
        }
        if (msgEl) lastMessage = msgEl.textContent?.trim() || "";

        // Find timestamp
        var time = new Date().toISOString();
        var timeEl = qsWithin(chat, '[data-testid="cell-frame-primary-detail"]') ||
          qsWithin(chat, '[data-testid="msg-time"]') ||
          qsWithin(chat, 'time');
        if (!timeEl) {
          // Heuristic: small text that looks like time
          var smallSpans = qsaWithin(chat, 'span');
          for (var ss of smallSpans) {
            var st = ss.textContent?.trim();
            if (st && /^\d{1,2}[:.]\d{2}/.test(st)) { timeEl = ss; break; }
          }
        }
        if (timeEl) time = timeEl.textContent?.trim() || time;

        messages.push({
          contact: contactName,
          lastMessage: lastMessage,
          time: time,
          unreadCount: count,
          isVerify: isVerify && count === 0,
        });
        processed++;
      }

      return { success: true, messages: messages, scanned: chatItems.length, method: method };
    },
  });
  return results?.[0]?.result || { success: false, error: "No result" };
}

// ── AI-powered readUnread ──
async function executeReadUnreadFlow(tabId) {
  var discovery = await waitForRenderableWaUi(tabId, 4, [700, 1100, 1600]);
  if (discovery?.hasQR) {
    return { success: false, error: "WhatsApp Web non connesso - scansiona il QR code" };
  }

  var config = await getConfig();
  if (config.supabaseUrl && config.anonKey) {
    var sidebarHtml = await grabSidebarHtml(tabId);
    if (sidebarHtml && sidebarHtml.length > 100) {
      console.log("[WA] Sending " + sidebarHtml.length + " chars to AI");
      var aiResult = await callAiExtract(sidebarHtml, "sidebar", config.supabaseUrl, config.anonKey, config.authToken);
      if (aiResult?.success && aiResult.items?.length > 0) {
        console.log("[WA] AI extracted " + aiResult.items.length + " chats");
        return {
          success: true,
          messages: aiResult.items.map(function(item) {
            return {
              contact: item.contact || "Sconosciuto",
              lastMessage: item.lastMessage || "",
              time: item.time || new Date().toISOString(),
              unreadCount: item.unreadCount || 1,
            };
          }),
          scanned: 0,
          method: "ai",
          diagnostic: compactDiscovery(discovery),
        };
      }
      console.log("[WA] AI returned 0 items, falling back to DOM");
    }
  }

  console.log("[WA] Using DOM discovery for readUnread");
  var domResult = await readUnreadDOM(tabId);
  if (domResult) {
    domResult.method = domResult.method || "dom";
    domResult.diagnostic = compactDiscovery(discovery);
  }

  if (domResult && domResult.messages?.length === 0 && config.supabaseUrl) {
    console.log("[WA] DOM found 0 items, triggering learnDom...");
    var learnResult = await learnDomSelectors(tabId);
    if (learnResult?.success) {
      var retryResult = await readUnreadDOM(tabId);
      if (retryResult) {
        retryResult.method = "dom-after-learn";
        retryResult.diagnostic = compactDiscovery(discovery);
      }
      return retryResult;
    }
  }

  return domResult;
}

async function readUnreadMessages() {
  try {
    var r = await getOrCreateWaTab();
    var tab = r.tab;
    await sleep(r.reused ? 1500 : 5000);
    var preflight = await runDiscoveryScript(tab.id);
    var shouldHydrateVisible = !tab.active && (!preflight || (!preflight.hasQR && !hasRenderableWaUi(preflight) && (hasShellSignals(preflight) || preflight.appLoaded)));

    if (shouldHydrateVisible) {
      console.log("[WA] Background shell detected, temporarily activating tab for hydration");
      return await withTemporarilyVisibleTab(tab.id, async function() {
        return await executeReadUnreadFlow(tab.id);
      });
    }

    return await executeReadUnreadFlow(tab.id);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Grab sidebar HTML using discovery ──
async function grabSidebarHtml(tabId) {
  var results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function() {
      function scanShadowRoots(root, roots, seen) {
        try {
          var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
          while (walker.nextNode()) {
            var el = walker.currentNode;
            if (el && el.shadowRoot && !seen.has(el.shadowRoot)) {
              seen.add(el.shadowRoot);
              roots.push(el.shadowRoot);
              scanShadowRoots(el.shadowRoot, roots, seen);
            }
          }
        } catch (_) {}
      }
      var rootsCache = null;
      function getRoots() {
        if (rootsCache) return rootsCache;
        var roots = [document];
        var seen = new Set([document]);
        scanShadowRoots(document, roots, seen);
        rootsCache = roots;
        return roots;
      }
      function qsaDeep(sel) {
        var out = [];
        var seen = new Set();
        for (var root of getRoots()) {
          try {
            root.querySelectorAll(sel).forEach(function(el) {
              if (!seen.has(el)) {
                seen.add(el);
                out.push(el);
              }
            });
          } catch (_) {}
        }
        return out;
      }
      function qsDeep(sel) {
        var els = qsaDeep(sel);
        return els[0] || null;
      }
      // Try multiple selectors for the sidebar container
      var candidates = [
        '#pane-side',
        '#side',
        '[data-testid="chatlist"]',
        '[data-testid="chat-list"]',
        '[role="navigation"]',
        '[aria-label*="chat" i]',
        '[aria-label*="elenco" i]',
      ];
      for (var sel of candidates) {
        var el = qsDeep(sel);
        if (el && el.outerHTML.length > 100) return el.outerHTML;
      }

      // Fallback: find container with most span[title] descendants
      var allContainers = qsaDeep('div, nav, section, aside');
      var best = null, bestScore = 0;
      for (var cont of allContainers) {
        var titleCount = cont.querySelectorAll('span[title]').length;
        var html = cont.outerHTML;
        // Must have multiple titled spans and reasonable size
        if (titleCount >= 3 && html.length > 200 && html.length < 500000) {
          var score = titleCount / (html.length / 1000); // density score
          if (score > bestScore) {
            bestScore = score;
            best = cont;
          }
        }
      }
      return best ? best.outerHTML : null;
    },
  });
  return results?.[0]?.result || null;
}

// ══════════════════════════════════════════════
// LEARN DOM — AI self-healing selector discovery
// ══════════════════════════════════════════════
async function learnDomSelectors(tabId) {
  try {
    if (!tabId) {
      var r = await getOrCreateWaTab();
      tabId = r.tab.id;
      await sleep(r.reused ? 1000 : 4000);
    }

    // Capture structural snapshot
    var results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function() {
        function scanShadowRoots(root, roots, seen) {
          try {
            var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
            while (walker.nextNode()) {
              var el = walker.currentNode;
              if (el && el.shadowRoot && !seen.has(el.shadowRoot)) {
                seen.add(el.shadowRoot);
                roots.push(el.shadowRoot);
                scanShadowRoots(el.shadowRoot, roots, seen);
              }
            }
          } catch (_) {}
        }
        var rootsCache = null;
        function getRoots() {
          if (rootsCache) return rootsCache;
          var roots = [document];
          var seen = new Set([document]);
          scanShadowRoots(document, roots, seen);
          rootsCache = roots;
          return roots;
        }
        function qsaDeep(sel) {
          var out = [];
          var seen = new Set();
          for (var root of getRoots()) {
            try {
              root.querySelectorAll(sel).forEach(function(el) {
                if (!seen.has(el)) {
                  seen.add(el);
                  out.push(el);
                }
              });
            } catch (_) {}
          }
          return out;
        }
        function qsDeep(sel) {
          var els = qsaDeep(sel);
          return els[0] || null;
        }
        var snapshot = { timestamp: Date.now() };

        // Collect all data-testid values
        var testIds = [];
        qsaDeep('[data-testid]').forEach(function(e) {
          testIds.push({
            testId: e.getAttribute('data-testid'),
            tag: e.tagName.toLowerCase(),
            role: e.getAttribute('role'),
            ariaLabel: e.getAttribute('aria-label'),
          });
        });
        snapshot.dataTestIds = testIds.slice(0, 100);

        // Collect role inventory
        var roles = {};
        qsaDeep('[role]').forEach(function(e) {
          var r = e.getAttribute('role');
          roles[r] = (roles[r] || 0) + 1;
        });
        snapshot.roles = roles;

        // Collect aria-labels
        var labels = [];
        qsaDeep('[aria-label]').forEach(function(e) {
          labels.push({
            label: e.getAttribute('aria-label'),
            tag: e.tagName.toLowerCase(),
            testId: e.getAttribute('data-testid'),
          });
        });
        snapshot.ariaLabels = labels.slice(0, 60);

        // Sample HTML from key areas
        var sidebar = qsDeep('#pane-side') ||
          qsDeep('#side') ||
          qsDeep('[data-testid="chatlist"]') ||
          qsDeep('[role="navigation"]');
        if (sidebar) snapshot.sidebarSample = sidebar.outerHTML.slice(0, 5000);

        var main = qsDeep('#main') ||
          qsDeep('[data-testid="conversation-panel-messages"]');
        if (main) snapshot.mainSample = main.outerHTML.slice(0, 3000);

        // If no sidebar found, grab a broad sample
        if (!snapshot.sidebarSample) {
          var app = document.querySelector('#app') || document.body;
          snapshot.broadSample = app.outerHTML.slice(0, 8000);
        }

        return snapshot;
      },
    });

    var snapshot = results?.[0]?.result;
    if (!snapshot) return { success: false, error: "Could not capture snapshot" };

    var config = await getConfig();
    if (!config.supabaseUrl || !config.anonKey) {
      return { success: false, error: "No config for AI call" };
    }

    var snapshotStr = JSON.stringify(snapshot);
    console.log("[WA] LearnDom snapshot: " + snapshotStr.length + " chars");

    var aiResult = await callAiExtract(snapshotStr, "learnDom", config.supabaseUrl, config.anonKey, config.authToken);
    if (aiResult?.success && aiResult.items?.length > 0) {
      var schema = aiResult.items[0];
      await saveSchema(schema);
      console.log("[WA] ✅ Learned " + Object.keys(schema).length + " selectors");
      return { success: true, schema: schema };
    }

    console.warn("[WA] LearnDom AI returned no results");
    return { success: false, error: "AI could not map selectors" };
  } catch (err) {
    console.error("[WA] LearnDom error:", err);
    return { success: false, error: err.message };
  }
}

// ══════════════════════════════════════════════
// SEND MESSAGE — discovery-based
// ══════════════════════════════════════════════
async function sendWhatsAppMessage(phone, text) {
  try {
    var existingTabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });

    if (existingTabs.length > 0) {
      var tabId = existingTabs[0].id;
      if (existingTabs[0].status !== "complete") await waitForLoad(tabId, 10000);

      var results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: async function(contact, msg) {
          async function openChat(name) {
            // Discovery-based search box
            var searchBox = document.querySelector('[data-testid="chat-list-search"]') ||
              document.querySelector('[contenteditable="true"][role="textbox"]') ||
              document.querySelector('[title*="earch" i]') ||
              document.querySelector('[title*="erca" i]') ||
              document.querySelector('[data-testid="search"]') ||
              document.querySelector('[aria-label*="search" i]') ||
              document.querySelector('[aria-label*="cerca" i]');

            if (searchBox) {
              var input = searchBox.querySelector('[contenteditable="true"]') ||
                searchBox.querySelector('input') || searchBox;
              input.focus();
              input.click();
              document.execCommand("selectAll");
              document.execCommand("insertText", false, name);
              await new Promise(function(r) { setTimeout(r, 1500); });

              // Click first matching result
              var chatResults = document.querySelectorAll('[data-testid="cell-frame-container"], [data-testid="chat-cell-wrapper"], [role="listitem"], [role="row"], [role="option"]');
              if (!chatResults.length) chatResults = document.querySelectorAll('span[title]');
              for (var i = 0; i < chatResults.length; i++) {
                var el = chatResults[i];
                var titleEl = el.querySelector ? el.querySelector('span[title]') : null;
                var title = titleEl ? (titleEl.getAttribute('title') || '') : (el.getAttribute('title') || '');
                if (title.toLowerCase().includes(name.toLowerCase())) {
                  var clickTarget = el.closest('[data-testid="cell-frame-container"]') ||
                    el.closest('[data-testid="chat-cell-wrapper"]') ||
                    el.closest('[role="listitem"]') ||
                    el.closest('[role="row"]') || el;
                  clickTarget.click();
                  await new Promise(function(r) { setTimeout(r, 800); });
                  var clearBtn = document.querySelector('[data-testid="x-alt"]') ||
                    document.querySelector('[data-testid="search-close"]') ||
                    document.querySelector('[data-testid="search-input-clear"]');
                  if (clearBtn) clearBtn.click();
                  return true;
                }
              }
              var esc = document.querySelector('[data-testid="x-alt"]') ||
                document.querySelector('[data-testid="search-close"]') ||
                document.querySelector('[data-testid="search-input-clear"]');
              if (esc) esc.click();
            }
            return false;
          }

          var opened = await openChat(contact);
          if (!opened) {
            var cleanPhone = contact.replace(/[^0-9]/g, "");
            if (cleanPhone.length >= 6) {
              window.location.href = "https://web.whatsapp.com/send?phone=" + cleanPhone + "&text=" + encodeURIComponent(msg);
              await new Promise(function(r) { setTimeout(r, 4000); });
            } else {
              return { success: false, error: "Contatto non trovato: " + contact };
            }
          }

          if (opened) {
            var inputBox = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
              document.querySelector('#main [contenteditable="true"]') ||
              document.querySelector('[role="textbox"][contenteditable="true"]');
            if (inputBox) {
              inputBox.focus();
              document.execCommand("insertText", false, msg);
              await new Promise(function(r) { setTimeout(r, 300); });
            }
          }

          var start = Date.now();
          while (Date.now() - start < 10000) {
            var btn = document.querySelector('span[data-icon="send"]') ||
              document.querySelector('[data-testid="send"]') ||
              document.querySelector('[data-testid="compose-btn-send"]') ||
              document.querySelector('button[aria-label*="end" i]') ||
              document.querySelector('button[aria-label*="nvia" i]');
            if (btn) {
              (btn.closest("button") || btn).click();
              await new Promise(function(r) { setTimeout(r, 1000); });
              return { success: true };
            }
            await new Promise(function(r) { setTimeout(r, 500); });
          }
          return { success: false, error: "Pulsante invio non trovato" };
        },
        args: [phone, text],
      });
      return results?.[0]?.result || { success: false, error: "Nessun risultato" };
    }

    // No existing tab — use send URL
    var cleanPhone = phone.replace(/[^0-9]/g, "");
    var url = WA_BASE + "/send?phone=" + cleanPhone + "&text=" + encodeURIComponent(text);
    var tab = await safeCreateTab(url, false);
    var loaded = await waitForLoad(tab.id, 30000);
    if (!loaded) { await safeRemoveTab(tab.id); return { success: false, error: "WA non caricato" }; }
    await sleep(3000);
    var results2 = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async function() {
        var start = Date.now();
        while (Date.now() - start < 15000) {
          if (document.querySelector('canvas[aria-label]') ||
              document.querySelector('[data-testid="qrcode"]'))
            return { success: false, error: "Non connesso a WhatsApp Web" };
          var btn = document.querySelector('span[data-icon="send"]') ||
            document.querySelector('[data-testid="send"]') ||
            document.querySelector('[data-testid="compose-btn-send"]') ||
            document.querySelector('button[aria-label*="end" i]') ||
            document.querySelector('button[aria-label*="nvia" i]');
          if (btn) {
            (btn.closest("button") || btn).click();
            await new Promise(function(r) { setTimeout(r, 1500); });
            return { success: true };
          }
          await new Promise(function(r) { setTimeout(r, 500); });
        }
        return { success: false, error: "Pulsante invio non trovato" };
      },
    });
    var result2 = results2?.[0]?.result;
    await sleep(500);
    await safeRemoveTab(tab.id);
    return result2 || { success: false, error: "Nessun risultato" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ══════════════════════════════════════════════
// READ THREAD — discovery-based
// ══════════════════════════════════════════════
async function readChatThread(contactName, maxMessages) {
  try {
    var r = await getOrCreateWaTab();
    await sleep(r.reused ? 1500 : 5000);

    var results = await chrome.scripting.executeScript({
      target: { tabId: r.tab.id },
      args: [contactName],
      func: async function(target) {
        function getSearchBox() {
          return document.querySelector('[data-testid="chat-list-search"] [contenteditable="true"]') ||
            document.querySelector('[data-testid="chat-list-search"]') ||
            document.querySelector('[title*="earch" i]') ||
            document.querySelector('[title*="erca" i]') ||
            document.querySelector('[data-testid="search"]') ||
            document.querySelector('[aria-label*="search" i]') ||
            document.querySelector('[aria-label*="cerca" i]') ||
            document.querySelector('[role="textbox"][contenteditable="true"]');
        }

        function clearAndType(field, value) {
          var input = field.querySelector ? (field.querySelector('[contenteditable="true"], input') || field) : field;
          input.focus();
          if (typeof input.click === "function") input.click();
          document.execCommand("selectAll");
          document.execCommand("delete");
          document.execCommand("insertText", false, value);
        }

        function currentChatMatches(name) {
          var header = document.querySelector('#main header span[title]') ||
            document.querySelector('#main header [dir="auto"]') ||
            document.querySelector('[data-testid="conversation-header"] span[title]');
          var label = header ? ((header.getAttribute("title") || header.textContent || "").trim()) : "";
          return !!label && label.toLowerCase().includes(name.toLowerCase());
        }

        if (!currentChatMatches(target)) {
          var searchBox = getSearchBox();
          if (!searchBox) return { success: false, error: "Search box not found" };
          clearAndType(searchBox, target);
          await new Promise(function(r) { setTimeout(r, 1500); });

          var chats = document.querySelectorAll('[data-testid="cell-frame-container"], [data-testid="chat-cell-wrapper"], [role="listitem"], [role="row"]');
          var clicked = false;
          for (var c of chats) {
            var titleEl = c.querySelector('span[title]');
            var title = titleEl ? (titleEl.getAttribute("title") || "") : "";
            if (title.toLowerCase().includes(target.toLowerCase())) {
              (c.closest('[data-testid="cell-frame-container"]') || c.closest('[data-testid="chat-cell-wrapper"]') || c).click();
              clicked = true;
              break;
            }
          }
          if (!clicked) return { success: false, error: "Chat non trovata: " + target };

          var clearBtn = document.querySelector('[data-testid="search-input-clear"]') ||
            document.querySelector('[data-testid="x-alt"]') ||
            document.querySelector('[data-testid="search-close"]');
          if (clearBtn) clearBtn.click();
          await new Promise(function(r) { setTimeout(r, 2000); });
        }

        var panel = document.querySelector('[data-testid="conversation-panel-messages"]') ||
          document.querySelector('#main [role="application"]') ||
          document.querySelector('#main');
        return { success: true, html: panel ? panel.outerHTML : null };
      },
    });

    var scriptResult = results?.[0]?.result;
    if (!scriptResult?.success) return scriptResult || { success: false, error: "Script error" };

    // Try AI extraction
    if (scriptResult.html) {
      var config = await getConfig();
      if (config.supabaseUrl && config.anonKey) {
        var aiResult = await callAiExtract(scriptResult.html, "thread", config.supabaseUrl, config.anonKey, config.authToken);
        if (aiResult?.success && aiResult.items?.length > 0) {
          return {
            success: true,
            messages: aiResult.items.map(function(m) {
              return { direction: m.direction || "inbound", text: m.text || "", timestamp: m.timestamp || "", contact: m.contact || contactName };
            }),
            contact: contactName,
            method: "ai",
          };
        }
      }
    }

    // DOM fallback
    var domResults = await chrome.scripting.executeScript({
      target: { tabId: r.tab.id },
      args: [contactName, maxMessages || 50],
      func: function(target, limit) {
        var msgEls = document.querySelectorAll('[data-testid="msg-container"]');
        if (!msgEls.length) msgEls = document.querySelectorAll('[role="row"][data-id]');
        var msgs = [];
        var items = Array.from(msgEls).slice(-limit);
        for (var el of items) {
          var isOut = !!(el.querySelector('[data-testid="msg-dblcheck"]') || el.querySelector('[data-testid="msg-check"]'));
          var textEl = el.querySelector('[data-testid="balloon-text"] span') ||
            el.querySelector('.selectable-text span') ||
            el.querySelector('[dir="ltr"]');
          var text = textEl?.textContent?.trim() || "";
          if (!text) continue;
          var timeEl = el.querySelector('[data-testid="msg-meta"] span') || el.querySelector('time');
          msgs.push({ direction: isOut ? "outbound" : "inbound", text: text, timestamp: timeEl?.textContent?.trim() || "", contact: isOut ? "me" : target });
        }
        return { success: true, messages: msgs, contact: target, method: "dom" };
      },
    });
    return domResults?.[0]?.result || { success: false, error: "DOM fallback failed" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ══════════════════════════════════════════════
// BACKFILL CHAT
// ══════════════════════════════════════════════
async function backfillChat(contactName, lastKnownText, maxScrolls) {
  var MAX_SCROLLS = maxScrolls || 30;
  try {
    var r = await getOrCreateWaTab();
    await sleep(r.reused ? 1500 : 5000);

    // Open chat (reuse readThread logic)
    var openResult = await chrome.scripting.executeScript({
      target: { tabId: r.tab.id },
      args: [contactName],
      func: async function(target) {
        function currentChatMatches(name) {
          var header = document.querySelector('#main header span[title]') ||
            document.querySelector('#main header [dir="auto"]') ||
            document.querySelector('[data-testid="conversation-header"] span[title]');
          var label = header ? ((header.getAttribute("title") || header.textContent || "").trim()) : "";
          return !!label && label.toLowerCase().includes(name.toLowerCase());
        }

        if (currentChatMatches(target)) return { success: true };

        var searchBox = document.querySelector('[data-testid="chat-list-search"] [contenteditable="true"]') ||
          document.querySelector('[data-testid="chat-list-search"]') ||
          document.querySelector('[title*="earch" i]') ||
          document.querySelector('[title*="erca" i]') ||
          document.querySelector('[aria-label*="search" i]') ||
          document.querySelector('[aria-label*="cerca" i]');
        if (!searchBox) return { success: false, error: "Search box not found" };

        var input = searchBox.querySelector ? (searchBox.querySelector('[contenteditable="true"], input') || searchBox) : searchBox;
        input.focus();
        input.click();
        document.execCommand("selectAll");
        document.execCommand("delete");
        document.execCommand("insertText", false, target);
        await new Promise(function(r) { setTimeout(r, 1500); });

        var chats = document.querySelectorAll('[data-testid="cell-frame-container"], [data-testid="chat-cell-wrapper"], [role="listitem"], [role="row"]');
        var clicked = false;
        for (var c of chats) {
          var titleEl = c.querySelector('span[title]');
          var title = titleEl ? (titleEl.getAttribute("title") || "") : "";
          if (title.toLowerCase().includes(target.toLowerCase())) {
            (c.closest('[data-testid="cell-frame-container"]') || c.closest('[data-testid="chat-cell-wrapper"]') || c).click();
            clicked = true;
            break;
          }
        }

        var clearBtn = document.querySelector('[data-testid="search-input-clear"]') ||
          document.querySelector('[data-testid="x-alt"]') || document.querySelector('[data-testid="search-close"]');
        if (clearBtn) clearBtn.click();

        if (!clicked) return { success: false, error: "Chat non trovata: " + target };
        await new Promise(function(r) { setTimeout(r, 2000); });
        return { success: true };
      },
    });

    var openRes = openResult?.[0]?.result;
    if (!openRes?.success) return openRes || { success: false, error: "Open failed" };

    // Scroll up and collect
    var allMessages = [];
    var foundLast = false;
    var scrollDelays = [1, 2, 1.5, 3, 1, 2.5, 2, 1, 3, 1.5];
    var scrollIdx;

    for (scrollIdx = 0; scrollIdx < MAX_SCROLLS && !foundLast; scrollIdx++) {
      var scrollResult = await chrome.scripting.executeScript({
        target: { tabId: r.tab.id },
        args: [contactName, lastKnownText || ""],
        func: function(contact, lastText) {
          var panel = document.querySelector('[data-testid="conversation-panel-messages"]') ||
            document.querySelector('#main [role="application"]') || document.querySelector("#main");
          if (!panel) return { success: false, error: "Panel not found" };
          var scrollContainer = panel.closest('[data-testid="conversation-panel-body"]') || panel.parentElement;
          if (scrollContainer) scrollContainer.scrollTop = 0;

          var msgEls = document.querySelectorAll('[data-testid="msg-container"]');
          if (!msgEls.length) msgEls = document.querySelectorAll('[role="row"][data-id]');
          var msgs = [];
          var hitLast = false;
          for (var el of msgEls) {
            var isOut = !!(el.querySelector('[data-testid="msg-dblcheck"]') || el.querySelector('[data-testid="msg-check"]'));
            var textEl = el.querySelector('[data-testid="balloon-text"] span') ||
              el.querySelector('.selectable-text span') || el.querySelector('[dir="ltr"]');
            var text = textEl?.textContent?.trim() || "";
            if (!text) continue;
            if (lastText && text === lastText) { hitLast = true; break; }
            var timeEl = el.querySelector('[data-testid="msg-meta"] span') || el.querySelector('time');
            msgs.push({ direction: isOut ? "outbound" : "inbound", text: text, timestamp: timeEl?.textContent?.trim() || "", contact: isOut ? "me" : contact });
          }
          return { success: true, messages: msgs, foundLast: hitLast, totalInDom: msgEls.length };
        },
      });

      var res = scrollResult?.[0]?.result;
      if (!res?.success) break;
      if (res.messages?.length) {
        for (var m of res.messages) {
          var isDup = allMessages.some(function(existing) { return existing.text === m.text && existing.timestamp === m.timestamp; });
          if (!isDup) allMessages.push(m);
        }
      }
      if (res.foundLast) { foundLast = true; break; }
      await sleep(scrollDelays[scrollIdx % scrollDelays.length] * 1000);
    }

    return { success: true, messages: allMessages, contact: contactName, foundLast: foundLast, scrollCount: scrollIdx };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ══════════════════════════════════════════════
// DIAGNOSTIC — full DOM discovery report
// ══════════════════════════════════════════════
async function diagnosticDom() {
  try {
    var r = await getOrCreateWaTab();
    await sleep(r.reused ? 1000 : 4000);
    var result = await runDiscoveryScript(r.tab.id);
    var shouldHydrateVisible = !r.tab.active && (!result || (!result.hasQR && !hasRenderableWaUi(result) && (hasShellSignals(result) || result.appLoaded)));
    if (shouldHydrateVisible) {
      result = await withTemporarilyVisibleTab(r.tab.id, async function() {
        return await waitForRenderableWaUi(r.tab.id, 4, [900, 1400, 2000]);
      }) || result;
    }
    return result ? { success: true, ...result } : { success: false, error: "no result" };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ══════════════════════════════════════════════
// LIFECYCLE
// ══════════════════════════════════════════════
chrome.runtime.onInstalled.addListener(function() {
  loadSchema();
  syncBridgeAcrossOpenTabs().catch(function(){});
});
chrome.runtime.onStartup.addListener(function() {
  loadSchema();
  syncBridgeAcrossOpenTabs().catch(function(){});
});
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === "complete" && tab.url && isAppUrl(tab.url)) {
    injectBridgeIntoTab(tabId).catch(function(){});
  }
});

// ══════════════════════════════════════════════
// MESSAGE HANDLER
// ══════════════════════════════════════════════
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.source !== "wa-content-bridge") return false;

  if (msg.action === "ping") {
    sendResponse({ success: true, version: "4.2-domfocus" });
    return false;
  }

  if (msg.action === "setConfig") {
    chrome.storage.local.set({
      supabaseUrl: msg.supabaseUrl || "",
      anonKey: msg.anonKey || "",
      authToken: msg.authToken || "",
    }).then(function() { sendResponse({ success: true }); });
    return true;
  }

  if (msg.action === "verifySession") {
    verifySession().then(sendResponse);
    return true;
  }

  if (msg.action === "sendWhatsApp") {
    if (!msg.phone || !msg.text) { sendResponse({ success: false, error: "phone e text richiesti" }); return false; }
    sendWhatsAppMessage(msg.phone, msg.text).then(sendResponse);
    return true;
  }

  if (msg.action === "readUnread") {
    readUnreadMessages().then(sendResponse);
    return true;
  }

  if (msg.action === "learnDom") {
    learnDomSelectors().then(sendResponse);
    return true;
  }

  if (msg.action === "diagnosticDom") {
    diagnosticDom().then(sendResponse);
    return true;
  }

  if (msg.action === "readThread") {
    if (!msg.contact) { sendResponse({ success: false, error: "contact richiesto" }); return false; }
    readChatThread(msg.contact, msg.maxMessages || 50).then(sendResponse);
    return true;
  }

  if (msg.action === "backfillChat") {
    if (!msg.contact) { sendResponse({ success: false, error: "contact richiesto" }); return false; }
    backfillChat(msg.contact, msg.lastKnownText || "", msg.maxScrolls || 30).then(sendResponse);
    return true;
  }

  sendResponse({ success: false, error: "Azione sconosciuta: " + msg.action });
  return false;
});
