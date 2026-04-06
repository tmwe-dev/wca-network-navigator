// ══════════════════════════════════════════════
// WhatsApp Extension v5.0 — AI Extract Module
// Schema cache with composite key, AI edge
// function calls, DOM learning with failure-based
// invalidation
// ══════════════════════════════════════════════

var AiExtract = (function () {
  var SCHEMA_TTL_MS = 3 * 60 * 60 * 1000; // 3h
  var MAX_FAILURES_BEFORE_INVALIDATE = 3;

  var _schema = null;
  var _schemaAt = 0;
  var _schemaKey = "";
  var _failureCount = 0;
  var _learning = false;

  // ── Composite cache key ──
  function buildCacheKey(hostname) {
    return "wa_" + (hostname || "web.whatsapp.com");
  }

  // ── Load from storage ──
  async function loadSchema() {
    try {
      var data = await chrome.storage.local.get(["waSchema", "waSchemaAt", "waSchemaKey"]);
      if (data.waSchema && data.waSchemaAt) {
        _schema = data.waSchema;
        _schemaAt = data.waSchemaAt;
        _schemaKey = data.waSchemaKey || "";
      }
    } catch (_) {}
    return _schema;
  }

  // ── Save to storage ──
  async function saveSchema(schema, hostname) {
    _schema = schema;
    _schemaAt = Date.now();
    _schemaKey = buildCacheKey(hostname);
    _failureCount = 0;
    try {
      await chrome.storage.local.set({
        waSchema: _schema,
        waSchemaAt: _schemaAt,
        waSchemaKey: _schemaKey,
      });
    } catch (_) {}
  }

  function isSchemaStale() {
    if (!_schema) return true;
    if (Date.now() - _schemaAt > SCHEMA_TTL_MS) return true;
    if (_failureCount >= MAX_FAILURES_BEFORE_INVALIDATE) return true;
    return false;
  }

  function getSchema() { return _schema; }

  function reportFailure() {
    _failureCount++;
    if (_failureCount >= MAX_FAILURES_BEFORE_INVALIDATE) {
      console.warn("[WA AI] Schema invalidated after " + _failureCount + " failures");
      _schema = null;
      _schemaAt = 0;
    }
  }

  // ── Call AI edge function ──
  async function callAiExtract(html, mode) {
    if (!Config.hasConfig()) return null;
    try {
      var url = Config.getUrl() + "/functions/v1/whatsapp-ai-extract";
      var headers = {
        "Content-Type": "application/json",
        "apikey": Config.getKey(),
      };
      headers["Authorization"] = "Bearer " + (Config.getToken() || Config.getKey());

      var resp = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ html: html, mode: mode }),
      });
      if (!resp.ok) {
        console.warn("[WA AI] Edge error:", resp.status);
        return null;
      }
      return await resp.json();
    } catch (e) {
      console.warn("[WA AI] Fetch failed:", e.message);
      return null;
    }
  }

  // ── Grab sidebar HTML ──
  async function grabSidebarHtml(tabId) {
    var results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () {
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
          var roots = [document]; var seen = new Set([document]);
          scanShadowRoots(document, roots, seen);
          rootsCache = roots; return roots;
        }
        function qsaDeep(sel) {
          var out = [], seen = new Set();
          for (var root of getRoots()) {
            try {
              root.querySelectorAll(sel).forEach(function (el) {
                if (!seen.has(el)) { seen.add(el); out.push(el); }
              });
            } catch (_) {}
          }
          return out;
        }
        function qsDeep(sel) { return qsaDeep(sel)[0] || null; }

        var candidates = [
          '#pane-side', '#side',
          '[data-testid="chatlist"]', '[data-testid="chat-list"]',
          '[role="navigation"]',
          '[aria-label*="chat" i]', '[aria-label*="elenco" i]',
        ];
        for (var sel of candidates) {
          var el = qsDeep(sel);
          if (el && el.outerHTML.length > 100) return el.outerHTML;
        }
        // Fallback: container with most span[title] density
        var allContainers = qsaDeep('div, nav, section, aside');
        var best = null, bestScore = 0;
        for (var cont of allContainers) {
          var titleCount = cont.querySelectorAll('span[title]').length;
          var html = cont.outerHTML;
          if (titleCount >= 3 && html.length > 200 && html.length < 500000) {
            var score = titleCount / (html.length / 1000);
            if (score > bestScore) { bestScore = score; best = cont; }
          }
        }
        return best ? best.outerHTML : null;
      },
    });
    return results && results[0] ? results[0].result : null;
  }

  // ── Learn DOM selectors via AI ──
  async function learnDomSelectors(tabId) {
    if (_learning) return { success: false, error: "Learning already in progress" };
    _learning = true;
    try {
      if (!tabId) {
        var r = await TabManager.getOrCreateWaTab();
        tabId = r.tab.id;
        await TabManager.sleep(r.reused ? 1000 : 4000);
      }

      var results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function () {
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
            var roots = [document]; var seen = new Set([document]);
            scanShadowRoots(document, roots, seen);
            rootsCache = roots; return roots;
          }
          function qsaDeep(sel) {
            var out = [], seen = new Set();
            for (var root of getRoots()) {
              try { root.querySelectorAll(sel).forEach(function (el) { if (!seen.has(el)) { seen.add(el); out.push(el); } }); }
              catch (_) {}
            }
            return out;
          }
          function qsDeep(sel) { return qsaDeep(sel)[0] || null; }

          var snapshot = { timestamp: Date.now() };

          // data-testid inventory
          var testIds = [];
          qsaDeep('[data-testid]').forEach(function (e) {
            testIds.push({
              testId: e.getAttribute('data-testid'),
              tag: e.tagName.toLowerCase(),
              role: e.getAttribute('role'),
              ariaLabel: e.getAttribute('aria-label'),
            });
          });
          snapshot.dataTestIds = testIds.slice(0, 100);

          // Role inventory
          var roles = {};
          qsaDeep('[role]').forEach(function (e) {
            var r = e.getAttribute('role');
            roles[r] = (roles[r] || 0) + 1;
          });
          snapshot.roles = roles;

          // Aria-labels
          var labels = [];
          qsaDeep('[aria-label]').forEach(function (e) {
            labels.push({
              label: e.getAttribute('aria-label'),
              tag: e.tagName.toLowerCase(),
              testId: e.getAttribute('data-testid'),
            });
          });
          snapshot.ariaLabels = labels.slice(0, 60);

          // HTML samples
          var sidebar = qsDeep('#pane-side') || qsDeep('#side') ||
            qsDeep('[data-testid="chatlist"]') || qsDeep('[role="navigation"]');
          if (sidebar) snapshot.sidebarSample = sidebar.outerHTML.slice(0, 5000);

          var main = qsDeep('#main') || qsDeep('[data-testid="conversation-panel-messages"]');
          if (main) snapshot.mainSample = main.outerHTML.slice(0, 3000);

          if (!snapshot.sidebarSample) {
            var app = document.querySelector('#app') || document.body;
            snapshot.broadSample = app.outerHTML.slice(0, 8000);
          }

          return snapshot;
        },
      });

      var snapshot = results && results[0] ? results[0].result : null;
      if (!snapshot) { _learning = false; return { success: false, error: "Could not capture snapshot" }; }

      if (!Config.hasConfig()) { _learning = false; return { success: false, error: "No config for AI call" }; }

      var aiResult = await callAiExtract(JSON.stringify(snapshot), "learnDom");
      if (aiResult && aiResult.success && aiResult.items && aiResult.items.length > 0) {
        var schema = aiResult.items[0];
        await saveSchema(schema, "web.whatsapp.com");
        console.log("[WA AI] ✅ Learned " + Object.keys(schema).length + " selectors");
        _learning = false;
        return { success: true, schema: schema };
      }

      console.warn("[WA AI] LearnDom returned no results");
      _learning = false;
      return { success: false, error: "AI could not map selectors" };
    } catch (err) {
      console.error("[WA AI] LearnDom error:", err);
      _learning = false;
      return { success: false, error: err.message };
    }
  }

  return {
    loadSchema: loadSchema,
    saveSchema: saveSchema,
    isSchemaStale: isSchemaStale,
    getSchema: getSchema,
    reportFailure: reportFailure,
    callAiExtract: callAiExtract,
    grabSidebarHtml: grabSidebarHtml,
    learnDomSelectors: learnDomSelectors,
  };
})();
