// ══════════════════════════════════════════════
// WhatsApp Extension v5.0 — AI Extract Module
// Schema cache with composite key, AI edge
// function calls, DOM learning with failure-based
// invalidation
// ══════════════════════════════════════════════

var AiExtract = globalThis.AiExtract || (function () {
  const SCHEMA_TTL_MS = 3 * 60 * 60 * 1000; // 3h
  const MAX_FAILURES_BEFORE_INVALIDATE = 3;

  let _schema = null;
  let _schemaAt = 0;
  let _schemaKey = "";
  let _failureCount = 0;
  let _learning = false;

  // ── Composite cache key ──
  function buildCacheKey(hostname) {
    return "wa_" + (hostname || "web.whatsapp.com");
  }

  // ── Load from storage ──
  async function loadSchema() {
    try {
      const data = await chrome.storage.local.get(["waSchema", "waSchemaAt", "waSchemaKey"]);
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

  // Call AI edge function via webapp bridge (CORS-safe)
  async function callAiExtract(html, mode) {
    if (!Config.hasConfig()) return null;
    try {
      var result = await AiBridge.callAiExtract(html, mode);
      if (!result) {
        console.warn("[WA AI] Bridge returned null");
        return null;
      }
      return result;
    } catch (e) {
      console.warn("[WA AI] Bridge call failed:", e.message);
      return null;
    }
  }

  // ── Grab sidebar HTML ──
  async function grabSidebarHtml(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () {
        function scanShadowRoots(root, roots, seen) {
          try {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
            while (walker.nextNode()) {
              const el = walker.currentNode;
              if (el && el.shadowRoot && !seen.has(el.shadowRoot)) {
                seen.add(el.shadowRoot);
                roots.push(el.shadowRoot);
                scanShadowRoots(el.shadowRoot, roots, seen);
              }
            }
          } catch (_) {}
        }
        let rootsCache = null;
        function getRoots() {
          if (rootsCache) return rootsCache;
          const roots = [document]; const seen = new Set([document]);
          scanShadowRoots(document, roots, seen);
          rootsCache = roots; return roots;
        }
        function qsaDeep(sel) {
          const out = [], seen = new Set();
          for (const root of getRoots()) {
            try {
              root.querySelectorAll(sel).forEach(function (el) {
                if (!seen.has(el)) { seen.add(el); out.push(el); }
              });
            } catch (_) {}
          }
          return out;
        }
        function qsDeep(sel) { return qsaDeep(sel)[0] || null; }

        const candidates = [
          '#pane-side', '#side',
          '[data-testid="chatlist"]', '[data-testid="chat-list"]',
          '[role="navigation"]',
          '[aria-label*="chat" i]', '[aria-label*="elenco" i]',
        ];
        for (const sel of candidates) {
          const el = qsDeep(sel);
          if (el && el.outerHTML.length > 100) return el.outerHTML;
        }
        // Fallback: container with most span[title] density
        const allContainers = qsaDeep('div, nav, section, aside');
        let best = null, bestScore = 0;
        for (const cont of allContainers) {
          const titleCount = cont.querySelectorAll('span[title]').length;
          const html = cont.outerHTML;
          if (titleCount >= 3 && html.length > 200 && html.length < 500000) {
            const score = titleCount / (html.length / 1000);
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
        const r = await TabManager.getOrCreateWaTab();
        tabId = r.tab.id;
        await TabManager.sleep(r.reused ? 1000 : 4000);
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function () {
          function scanShadowRoots(root, roots, seen) {
            try {
              const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
              while (walker.nextNode()) {
                const el = walker.currentNode;
                if (el && el.shadowRoot && !seen.has(el.shadowRoot)) {
                  seen.add(el.shadowRoot);
                  roots.push(el.shadowRoot);
                  scanShadowRoots(el.shadowRoot, roots, seen);
                }
              }
            } catch (_) {}
          }
          let rootsCache = null;
          function getRoots() {
            if (rootsCache) return rootsCache;
            const roots = [document]; const seen = new Set([document]);
            scanShadowRoots(document, roots, seen);
            rootsCache = roots; return roots;
          }
          function qsaDeep(sel) {
            const out = [], seen = new Set();
            for (const root of getRoots()) {
              try { root.querySelectorAll(sel).forEach(function (el) { if (!seen.has(el)) { seen.add(el); out.push(el); } }); }
              catch (_) {}
            }
            return out;
          }
          function qsDeep(sel) { return qsaDeep(sel)[0] || null; }

          const snapshot = { timestamp: Date.now() };

          // data-testid inventory
          const testIds = [];
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
          const roles = {};
          qsaDeep('[role]').forEach(function (e) {
            const r = e.getAttribute('role');
            roles[r] = (roles[r] || 0) + 1;
          });
          snapshot.roles = roles;

          // Aria-labels
          const labels = [];
          qsaDeep('[aria-label]').forEach(function (e) {
            labels.push({
              label: e.getAttribute('aria-label'),
              tag: e.tagName.toLowerCase(),
              testId: e.getAttribute('data-testid'),
            });
          });
          snapshot.ariaLabels = labels.slice(0, 60);

          // HTML samples
          const sidebar = qsDeep('#pane-side') || qsDeep('#side') ||
            qsDeep('[data-testid="chatlist"]') || qsDeep('[role="navigation"]');
          if (sidebar) snapshot.sidebarSample = sidebar.outerHTML.slice(0, 5000);

          const main = qsDeep('#main') || qsDeep('[data-testid="conversation-panel-messages"]');
          if (main) snapshot.mainSample = main.outerHTML.slice(0, 3000);

          if (!snapshot.sidebarSample) {
            const app = document.querySelector('#app') || document.body;
            snapshot.broadSample = app.outerHTML.slice(0, 8000);
          }

          return snapshot;
        },
      });

      const snapshot = results && results[0] ? results[0].result : null;
      if (!snapshot) { _learning = false; return { success: false, error: "Could not capture snapshot" }; }

      if (!Config.hasConfig()) { _learning = false; return { success: false, error: "No config for AI call" }; }

      const aiResult = await callAiExtract(JSON.stringify(snapshot), "learnDom");
      if (aiResult && aiResult.success && aiResult.items && aiResult.items.length > 0) {
        const schema = aiResult.items[0];
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
globalThis.AiExtract = AiExtract;
