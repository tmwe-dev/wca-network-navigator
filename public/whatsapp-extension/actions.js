// ══════════════════════════════════════════════
// WhatsApp Extension v5.1 — Actions Module
// CSP-compliant: no new Function() / eval
// Uses inject-once helpers pattern
// ══════════════════════════════════════════════

var Actions = globalThis.Actions || (function () {

  // ══════════════════════════════════════════════
  // INJECT-ONCE: Page helpers (shadow DOM, input)
  // Called once per tab, installs window.__waH
  // ══════════════════════════════════════════════
  async function ensurePageHelpers(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () {
        if (window.__waH) return;

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

        let _rootsCache = null;
        function getGlobalRoots() {
          if (_rootsCache) return _rootsCache;
          const roots = [document]; const seen = new Set([document]);
          scanShadowRoots(document, roots, seen);
          _rootsCache = roots; return roots;
        }

        function getNestedRoots(root) {
          const roots = [root]; const seen = new Set([root]);
          scanShadowRoots(root, roots, seen);
          return roots;
        }

        function queryAllFromRoots(roots, sel) {
          const out = []; const seen = new Set();
          for (const root of roots) {
            try { root.querySelectorAll(sel).forEach(function(el) { if (!seen.has(el)) { seen.add(el); out.push(el); } }); }
            catch (_) {}
          }
          return out;
        }

        function qsaDeep(sel) { return queryAllFromRoots(getGlobalRoots(), sel); }
        function qsDeep(sel) { return qsaDeep(sel)[0] || null; }
        function qsaWithin(root, sel) { return queryAllFromRoots(getNestedRoots(root), sel); }
        function qsWithin(root, sel) { return qsaWithin(root, sel)[0] || null; }

        function filterVisible(els) {
          return Array.from(els || []).filter(function(el) {
            try {
              const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
              return !rect || rect.width > 0 || rect.height > 0;
            } catch (_) { return true; }
          });
        }

        function modernClearAndType(el, text) {
          let input = el;
          if (el.querySelector) {
            input = el.querySelector('[contenteditable="true"], input') || el;
          }
          input.focus();
          if (typeof input.click === "function") input.click();

          const sel = window.getSelection();
          if (sel && input.childNodes.length > 0) {
            const range = document.createRange();
            range.selectNodeContents(input);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          if (sel && !sel.isCollapsed) {
            sel.deleteFromDocument();
          }

          if (input.getAttribute("contenteditable") === "true") {
            input.textContent = "";
            input.dispatchEvent(new InputEvent("beforeinput", {
              inputType: "insertText", data: text, bubbles: true, cancelable: true, composed: true
            }));
            input.textContent = text;
            input.dispatchEvent(new InputEvent("input", {
              inputType: "insertText", data: text, bubbles: true, composed: true
            }));
          } else if (input.tagName === "INPUT" || input.tagName === "TEXTAREA") {
            const nativeSetter = Object.getOwnPropertyDescriptor(
              input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value"
            ).set;
            nativeSetter.call(input, text);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }

        function modernInsertText(el, text) {
          el.focus();
          if (el.getAttribute("contenteditable") === "true") {
            el.dispatchEvent(new InputEvent("beforeinput", {
              inputType: "insertText", data: text, bubbles: true, cancelable: true, composed: true
            }));
            const dt = new DataTransfer();
            dt.setData("text/plain", text);
            el.dispatchEvent(new InputEvent("input", {
              inputType: "insertText", data: text, dataTransfer: dt,
              bubbles: true, composed: true
            }));
            if (!el.textContent.includes(text)) {
              el.textContent = text;
              el.dispatchEvent(new InputEvent("input", {
                inputType: "insertText", data: text, bubbles: true, composed: true
              }));
            }
          }
        }

        function invalidateCache() { _rootsCache = null; }

        window.__waH = {
          qsDeep: qsDeep, qsaDeep: qsaDeep,
          qsWithin: qsWithin, qsaWithin: qsaWithin,
          filterVisible: filterVisible,
          modernClearAndType: modernClearAndType,
          modernInsertText: modernInsertText,
          invalidateCache: invalidateCache,
        };
      },
    });
  }

  // ══════════════════════════════════════════════
  // VERIFY SESSION
  // ══════════════════════════════════════════════
  async function verifySession() {
    try {
      const existing = await TabManager.getBestExistingWaTab();
      let waTab;
      if (existing) {
        waTab = existing;
        if (waTab.status !== "complete") await TabManager.waitForLoad(waTab.id, 8000);
      } else {
        const r = await TabManager.getOrCreateWaTab();
        waTab = r.tab;
        await TabManager.sleep(3000);
      }

      let result = await Discovery.waitForRenderableWaUi(waTab.id, 3, [1200, 1800]);
      const shouldHydrate = !waTab.active && (!result || (!result.hasQR && !Discovery.hasRenderableWaUi(result) && (Discovery.hasShellSignals(result) || result.appLoaded)));

      if (shouldHydrate) {
        result = await TabManager.withTemporarilyVisibleTab(waTab.id, async function () {
          return await Discovery.waitForRenderableWaUi(waTab.id, 4, [900, 1400, 2000]);
        }) || result;
      }

      const diag = Discovery.compactDiscovery(result);
      if (result && result.hasQR) return { success: true, authenticated: false, reason: "qr_required", diagnostic: diag };
      if (result && (result.hasLoadingScreen || !result.appLoaded || result.bodyChildCount < 3)) return { success: true, authenticated: false, reason: "loading", diagnostic: diag };
      if (result && result.sidebar) return { success: true, authenticated: true, method: "sidebar:" + (result.sidebarSelector || "discovered"), diagnostic: diag };
      if ((result && result.chatItems || 0) > 0) return { success: true, authenticated: true, method: "chat-items:" + (result.chatItemsMethod || "discovered"), diagnostic: diag };
      if (result && (result.hasComposeBox || (result.textboxCount || 0) > 0)) return { success: true, authenticated: true, method: result.hasComposeBox ? "compose-box" : "textbox", diagnostic: diag };
      if (Discovery.hasShellSignals(result)) return { success: true, authenticated: true, method: "app-shell-fallback", diagnostic: diag };
      return { success: true, authenticated: false, reason: "unknown_state", diagnostic: diag };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ══════════════════════════════════════════════
  // READ UNREAD — injected page function
  // ══════════════════════════════════════════════
  function _pageReadUnreadDOM(schema) {
    const H = window.__waH;
    // Removed VERIFY_COUNT: only return chats with actual unread messages

    if (H.qsDeep('canvas[aria-label]') || H.qsDeep('[data-testid="qrcode"]') || H.qsDeep('[data-ref]'))
      return { success: false, error: "QR code visibile - accedi a WhatsApp Web" };

    let chatItems = [];
    let method = "none";

    // S1: Learned schema
    if (schema && schema.chatItem) {
      chatItems = H.filterVisible(H.qsaDeep(schema.chatItem));
      if (chatItems.length > 0) method = "learned:" + schema.chatItem;
    }
    if (chatItems.length === 0 && schema && schema.chatItemAlt) {
      chatItems = H.filterVisible(H.qsaDeep(schema.chatItemAlt));
      if (chatItems.length > 0) method = "learned-alt:" + schema.chatItemAlt;
    }

    // S2: data-testid
    if (chatItems.length === 0) {
      const testIdPatterns = ['cell-frame-container','chat-cell-wrapper','list-item','chatlist-item','chat-list-item'];
      for (const tid of testIdPatterns) {
        chatItems = H.filterVisible(H.qsaDeep('[data-testid="' + tid + '"]'));
        if (chatItems.length > 0) { method = "testid:" + tid; break; }
      }
    }

    // S3: role-based
    if (chatItems.length === 0) {
      const rolePatterns = [
        { sel: '[role="listitem"]', name: 'listitem' },
        { sel: '[role="row"]', name: 'row' },
        { sel: '[role="option"]', name: 'option' },
      ];
      for (const rp of rolePatterns) {
        chatItems = H.filterVisible(H.qsaDeep(rp.sel));
        if (chatItems.length >= 3) { method = "role:" + rp.name; break; }
      }
    }

    // S4: Container children
    if (chatItems.length === 0) {
      const containers = H.filterVisible(H.qsaDeep('[role="list"],[role="listbox"],[role="grid"],[role="navigation"]'));
      for (const cont of containers) {
        const vc = H.filterVisible(Array.from(cont.children || []));
        if (vc.length >= 3) { chatItems = vc; method = "container:" + cont.getAttribute("role"); break; }
      }
    }

    // S5: Heuristic
    if (chatItems.length === 0) {
      const allTitled = H.filterVisible(H.qsaDeep('span[title]'));
      const parentMap = new Map();
      for (const sp of allTitled) {
        const ancestor = sp.closest('[tabindex],[role="row"],[role="listitem"],[data-testid]');
        if (ancestor && !parentMap.has(ancestor)) parentMap.set(ancestor, true);
      }
      if (parentMap.size >= 3) { chatItems = Array.from(parentMap.keys()); method = "heuristic-titled-ancestors"; }
    }

    if (chatItems.length === 0) return { success: true, messages: [], scanned: 0, method: "none", error: "No chat items found" };

    const messages = [];
    let processed = 0;

    for (let i = 0; i < chatItems.length; i++) {
      const chat = chatItems[i];
      let badge = null, count = 0;

      badge = H.qsWithin(chat, '[data-testid="icon-unread-count"]') || H.qsWithin(chat, '[data-testid="unread-count"]');
      if (badge) count = parseInt(badge.textContent) || 1;

      if (!badge) {
        const ariaEls = H.qsaWithin(chat, 'span[aria-label]');
        for (const ae of ariaEls) {
          const label = (ae.getAttribute("aria-label") || "").toLowerCase();
          if (label.includes("unread") || label.includes("non lett") || label.includes("da leggere")) {
            count = parseInt(ae.textContent) || 1; badge = ae; break;
          }
        }
      }

      if (!badge) {
        const spans = H.qsaWithin(chat, 'span');
        for (const s of spans) {
          const txt = s.textContent.trim();
          if (txt && /^\d+$/.test(txt) && txt.length <= 4) {
            const bg = window.getComputedStyle(s).backgroundColor;
            const parentBg = s.parentElement ? window.getComputedStyle(s.parentElement).backgroundColor : "";
            if ((bg + parentBg).match(/37,\s*211|25d366|00a884|rgb\(0,\s*168|rgb\(37/i)) {
              count = parseInt(txt) || 1; badge = s; break;
            }
          }
        }
      }

      // Removed VERIFY_COUNT: only return actual unread items
      if (count === 0) continue;

      let contactName = "Sconosciuto";
      const titleEl = H.qsWithin(chat, 'span[title][dir="auto"]') || H.qsWithin(chat, 'span[title]') || H.qsWithin(chat, '[data-testid="cell-frame-title"] span');
      if (titleEl) contactName = titleEl.getAttribute("title") || titleEl.textContent?.trim() || "Sconosciuto";

      let lastMessage = "";
      let msgEl = H.qsWithin(chat, '[data-testid="last-msg-status"]') || H.qsWithin(chat, '[data-testid="cell-frame-secondary"] span[title]') || H.qsWithin(chat, '[data-testid="cell-frame-secondary"] span') || H.qsWithin(chat, '[data-testid="last-msg"] span');
      if (!msgEl) {
        const allSpans = H.qsaWithin(chat, 'span');
        const candidates = [];
        for (const sp2 of allSpans) {
          const t = sp2.textContent?.trim();
          if (t && t.length > 3 && t !== contactName && !/^\d+$/.test(t)) candidates.push(sp2);
        }
        if (candidates.length > 0) msgEl = candidates[candidates.length - 1];
      }
      if (msgEl) lastMessage = msgEl.textContent?.trim() || "";

      let time = new Date().toISOString();
      let timeEl = H.qsWithin(chat, '[data-testid="cell-frame-primary-detail"]') || H.qsWithin(chat, '[data-testid="msg-time"]') || H.qsWithin(chat, 'time');
      if (!timeEl) {
        const smallSpans = H.qsaWithin(chat, 'span');
        for (const ss of smallSpans) {
          const st = ss.textContent?.trim();
          if (st && /^\d{1,2}[:.]\d{2}/.test(st)) { timeEl = ss; break; }
        }
      }
      if (timeEl) time = timeEl.textContent?.trim() || time;

      messages.push({ contact: contactName, lastMessage: lastMessage, time: time, unreadCount: count });
      processed++;
    }
    return { success: true, messages: messages, scanned: chatItems.length, method: method };
  }

  async function readUnreadDOM(tabId) {
    await AiExtract.loadSchema();
    const schema = AiExtract.getSchema();
    await ensurePageHelpers(tabId);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      args: [schema],
      func: _pageReadUnreadDOM,
    });
    return results && results[0] ? results[0].result : { success: false, error: "No result" };
  }

  async function readUnreadMessages() {
    try {
      const r = await TabManager.getOrCreateWaTab();
      await TabManager.ensureTabVisibleAndWait(r.tab.id, 1200);
      await TabManager.sleep(r.reused ? 1200 : 4000);

      let optimus = await tryOptimusReadUnread(r.tab.id, false, null);
      if (optimus.success && optimus.items.length === 0 && optimus.cached) {
        optimus = await tryOptimusReadUnread(r.tab.id, true, "Cached plan returned 0 unread chats from sidebar");
      }

      if (optimus.success) {
        const normalizedItems = (optimus.items || []).map(function (item) {
          return {
            contact: String(item.contact || item.name || item.contact_name || "Sconosciuto").trim(),
            lastMessage: String(item.lastMessage || item.last_message || item.message || item.text || "").trim(),
            time: String(item.time || item.timestamp || item.date || new Date().toISOString()).trim(),
            unreadCount: parseInt(item.unreadCount || item.unread_count || item.unread || 0) || 0,
          };
        });
        return {
          success: true,
          messages: normalizedItems,
          scanned: optimus.candidates || normalizedItems.length || 0,
          method: optimus.cached ? "optimus-cache" : "optimus-ai",
          optimus: {
            cached: optimus.cached,
            planVersion: optimus.planVersion,
            confidence: optimus.confidence,
            latencyMs: optimus.latencyMs,
            dropped: optimus.dropped,
          },
        };
      }

      if (!optimus.optimusUnavailable) {
        return { success: false, error: optimus.error || "optimus_failed", method: "optimus-error" };
      }

      const domRes = await readUnreadDOM(r.tab.id);
      if (domRes) {
        domRes.method = "legacy-dom:" + (domRes.method || "unknown");
      }
      return domRes || { success: false, error: "Unread fallback failed" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Optimus-first: try AI extraction plan, fallback to legacy on 503 ──
  async function tryOptimusReadUnread(tabId, previousFailed, failureContext) {
    // 1. snapshot the sidebar
    const sidebarSelector = '[data-tab="3"], #pane-side, [role="grid"]';
    const snap = await Optimus.snapshotPage(tabId, sidebarSelector, 6, 3000);
    if (!snap || !snap.ok) return { success: false, error: snap && snap.error || "snapshot_failed", optimusUnavailable: false };

    // 2. build request payload with OptimusClient compatibility helper
    const req = OptimusClient.requestPlan("whatsapp", "sidebar", snap.snapshot, {
      previousPlanFailed: !!previousFailed,
      failureContext: failureContext || null,
    });
    const planRes = await Optimus.getPlan({
      channel: req.channel,
      pageType: req.pageType,
      snapshot: req.domSnapshot,
      hash: req.domHash,
      previousPlanFailed: req.previousPlanFailed,
      failureContext: req.failureContext,
    });

    if (!planRes || !planRes.success) {
      const code = planRes && planRes.code;
      // 503 / NO_APP_TAB / TIMEOUT → fall back to legacy
      return { success: false, error: planRes && planRes.error || "plan_failed", optimusUnavailable: true };
    }

    // 3. execute plan against the page
    const execRes = await Optimus.executePlanInTab(tabId, sidebarSelector, planRes.plan || planRes);
    if (!execRes || !execRes.success) return { success: false, error: execRes && execRes.error || "execute_failed", optimusUnavailable: false };

    return {
      success: true,
      cached: !!planRes.cached,
      planVersion: planRes.plan_version || 0,
      confidence: planRes.confidence || 0,
      latencyMs: planRes.ai_latency_ms || 0,
      items: execRes.items || [],
      candidates: execRes.candidates || 0,
      dropped: execRes.dropped || 0,
    };
  }

  // ── Optimus-first: extract messages from open chat panel ──
  // Returns { success, optimusUnavailable, items, cached, planVersion, confidence, latencyMs, dropped, candidates }
  async function tryOptimusReadThread(tabId, previousFailed, failureContext) {
    // Guard: if Optimus modules are not loaded, signal unavailable so legacy fallback kicks in
    if (typeof Optimus === "undefined" || typeof OptimusClient === "undefined") {
      return { success: false, error: "optimus_not_loaded", optimusUnavailable: true };
    }
    const panelSelector = '[data-testid="conversation-panel-messages"], #main [role="application"], #main';
    const snap = await Optimus.snapshotPage(tabId, panelSelector, 6, 3000);
    if (!snap || !snap.ok) return { success: false, error: snap && snap.error || "snapshot_failed", optimusUnavailable: false };

    const req = OptimusClient.requestPlan("whatsapp", "thread", snap.snapshot, {
      previousPlanFailed: !!previousFailed,
      failureContext: failureContext || null,
    });
    const planRes = await Optimus.getPlan({
      channel: req.channel,
      pageType: req.pageType,
      snapshot: req.domSnapshot,
      hash: req.domHash,
      previousPlanFailed: req.previousPlanFailed,
      failureContext: req.failureContext,
    });

    if (!planRes || !planRes.success) {
      return { success: false, error: planRes && planRes.error || "plan_failed", optimusUnavailable: true };
    }

    const execRes = await Optimus.executePlanInTab(tabId, panelSelector, planRes.plan || planRes);
    if (!execRes || !execRes.success) return { success: false, error: execRes && execRes.error || "execute_failed", optimusUnavailable: false };

    return {
      success: true,
      cached: !!planRes.cached,
      planVersion: planRes.plan_version || 0,
      confidence: planRes.confidence || 0,
      latencyMs: planRes.ai_latency_ms || 0,
      items: execRes.items || [],
      candidates: execRes.candidates || 0,
      dropped: execRes.dropped || 0,
    };
  }

  // Map Optimus extracted items to legacy message shape used by useWhatsAppAdaptiveSync
  function mapOptimusThreadItems(items, contactName) {
    return items.map(function (it) {
      // Optimus may return keys like message_text, message_sender, message_time, direction
      const text = it.message_text || it.text || it.body || "";
      const senderRaw = it.message_sender || it.sender || "";
      const timestamp = it.message_time || it.timestamp || it.time || "";
      // Detect direction: explicit field wins, otherwise infer from sender = "Tu"/"You"/"Me"
      let direction = it.direction || "";
      if (!direction) {
        const s = String(senderRaw).toLowerCase().trim();
        direction = (s === "tu" || s === "you" || s === "me" || s === "io") ? "outbound" : "inbound";
      }
      return {
        direction: direction,
        text: text,
        timestamp: timestamp,
        contact: direction === "outbound" ? "me" : (senderRaw || contactName),
      };
    }).filter(function (m) { return !!m.text; });
  }

  async function readThread(contactName, maxMessages) {
    const LIMIT = maxMessages || 50;
    try {
      const r = await TabManager.getOrCreateWaTab();
      // Bring the WA tab to foreground BEFORE sleep — background tabs throttle DOM
      await TabManager.ensureTabVisibleAndWait(r.tab.id, 1200);
      await TabManager.sleep(r.reused ? 1500 : 5000);
      await ensurePageHelpers(r.tab.id);

      // Step 1: open the target chat (this part stays as-is)
      const results = await chrome.scripting.executeScript({
        target: { tabId: r.tab.id },
        args: [contactName],
        func: _pageOpenAndReadThread,
      });

      const scriptResult = results && results[0] ? results[0].result : null;
      if (!scriptResult || !scriptResult.success) return scriptResult || { success: false, error: "Script error" };

      // Step 2: Optimus-first extraction
      let optimus = await tryOptimusReadThread(r.tab.id, false, null);
      if (optimus.success && optimus.items.length === 0 && optimus.cached) {
        optimus = await tryOptimusReadThread(r.tab.id, true, "Cached plan returned 0 messages from thread panel for " + contactName);
      }

      if (optimus.success) {
        const allMessages = mapOptimusThreadItems(optimus.items, contactName);
        const messages = allMessages.slice(-LIMIT);
        return {
          success: true,
          messages: messages,
          contact: contactName,
          method: optimus.cached ? "optimus-cache" : "optimus-ai",
          optimus: {
            cached: optimus.cached,
            planVersion: optimus.planVersion,
            confidence: optimus.confidence,
            latencyMs: optimus.latencyMs,
            dropped: optimus.dropped,
          },
        };
      }

      // Optimus reachable but failed structurally → propagate failure
      if (!optimus.optimusUnavailable) {
        return { success: false, error: optimus.error || "optimus_failed", method: "optimus-error", contact: contactName };
      }

      // ── Legacy fallback (only if Optimus unreachable: 503/no-app-tab/timeout) ──
      // Legacy Path A: AI extraction on the panel HTML
      if (scriptResult.html && Config.hasConfig()) {
        const aiResult = await AiExtract.callAiExtract(scriptResult.html, "thread");
        if (aiResult && aiResult.success && aiResult.items && aiResult.items.length > 0) {
          return {
            success: true,
            messages: aiResult.items.map(function (m) {
              return {
                direction: String(m.direction || (m.is_outbound ? "outbound" : "inbound")).trim(),
                text: String(m.text || m.message || m.content || "").trim(),
                timestamp: String(m.timestamp || m.time || m.date || "").trim(),
                contact: String(m.contact || m.sender || m.from || contactName).trim(),
              };
            }).slice(-LIMIT),
            contact: contactName,
            method: "legacy-ai",
          };
        }
      }

      // Legacy Path B: hardcoded DOM extraction
      const domResults = await chrome.scripting.executeScript({
        target: { tabId: r.tab.id },
        args: [contactName, LIMIT],
        func: _pageDomReadMessages,
      });
      const domRes = domResults && domResults[0] ? domResults[0].result : null;
      if (domRes) domRes.method = "legacy-dom:" + (domRes.method || "unknown");
      return domRes || { success: false, error: "DOM fallback failed" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Page-side fallback: after navigating to wa.me?phone=..., focus composer and click send
  function _pageSendUrlFallback() {
    const H = window.__waH;
    const composer = H.qsDeep('footer [contenteditable="true"]') || H.qsDeep('[data-testid="conversation-compose-box-input"]') || H.qsDeep('[data-testid="compose-box-input"]');
    if (!composer) return { success: false, error: "Composer not found after URL nav" };
    // Text is already pre-filled by ?text= param in WA Web — just focus & send
    composer.focus();
    const sendBtn = H.qsDeep('[data-testid="send"]') || H.qsDeep('button[aria-label*="send" i]') || H.qsDeep('button[aria-label*="invia" i]') || H.qsDeep('span[data-icon="send"]')?.closest('button');
    if (!sendBtn) return { success: false, error: "Send button not found after URL nav" };
    sendBtn.click();
    return { success: true, sent: true, method: "url-fallback" };
  }

  // Page-side primary path: search the contact in sidebar then send
  function _pageSendWhatsApp(target, messageText) {
    const H = window.__waH;
    const searchBox = H.qsDeep('[data-testid="chat-list-search"] [contenteditable="true"]') || H.qsDeep('[data-testid="chat-list-search"]') || H.qsDeep('[title*="earch" i]') || H.qsDeep('[title*="erca" i]');
    if (!searchBox) return { success: false, error: "Search box not found" };

    H.modernClearAndType(searchBox, target);
    return new Promise(function (resolve) {
      setTimeout(function () {
        const chats = H.qsaDeep('[data-testid="cell-frame-container"],[data-testid="chat-cell-wrapper"],[role="listitem"],[role="row"]');
        let clicked = false;
        for (const c of chats) {
          const titleEl = c.querySelector('span[title]');
          const title = titleEl ? (titleEl.getAttribute("title") || "") : "";
          if (title.toLowerCase().includes(target.toLowerCase())) {
            (c.closest('[data-testid="cell-frame-container"]') || c.closest('[data-testid="chat-cell-wrapper"]') || c).click();
            clicked = true; break;
          }
        }
        const clearBtn = H.qsDeep('[data-testid="search-input-clear"]') || H.qsDeep('[data-testid="x-alt"]') || H.qsDeep('[data-testid="search-close"]');
        if (clearBtn) clearBtn.click();
        if (!clicked) { resolve({ success: false, error: "Chat not found in sidebar: " + target }); return; }

        setTimeout(function () {
          const composer = H.qsDeep('footer [contenteditable="true"]') || H.qsDeep('[data-testid="conversation-compose-box-input"]') || H.qsDeep('[data-testid="compose-box-input"]');
          if (!composer) { resolve({ success: false, error: "Composer not found" }); return; }
          H.modernClearAndType(composer, messageText);
          const sendBtn = H.qsDeep('[data-testid="send"]') || H.qsDeep('button[aria-label*="send" i]') || H.qsDeep('button[aria-label*="invia" i]') || H.qsDeep('span[data-icon="send"]')?.closest('button');
          if (!sendBtn) { resolve({ success: false, error: "Send button not found" }); return; }
          sendBtn.click();
          resolve({ success: true, sent: true, method: "search" });
        }, 1500);
      }, 1500);
    });
  }

  async function sendWhatsAppMessage(phone, text) {
    try {
      // Determine if input is a phone number or contact name
      var cleanPhone = String(phone || "").replace(/[^0-9+]/g, "");
      var isPhoneNumber = cleanPhone.length >= 7;

      var existingTabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });

      if (existingTabs.length > 0) {
        var tabId = existingTabs[0].id;
        if (existingTabs[0].status !== "complete") await TabManager.waitForLoad(tabId, 10000);
        await TabManager.ensureTabVisibleAndWait(tabId, 1200);
        await ensurePageHelpers(tabId);

        // Try search-based send first (works for existing contacts)
        var results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          args: [phone, text],
          func: _pageSendWhatsApp,
        });
        var result = results && results[0] ? results[0].result : null;

        // If search failed and we have a phone number, try URL-based approach
        if (result && !result.success && isPhoneNumber) {
          var numericPhone = cleanPhone.replace(/^\+/, "");
          var sendUrl = Config.WA_BASE + "/send?phone=" + numericPhone + "&text=" + encodeURIComponent(text);
          await chrome.tabs.update(tabId, { url: sendUrl });
          await TabManager.waitForLoad(tabId, 15000);
          await TabManager.sleep(3000);
          await ensurePageHelpers(tabId);
          var urlResults = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: _pageSendUrlFallback,
          });
          return urlResults && urlResults[0] ? urlResults[0].result : { success: false, error: "URL send failed" };
        }

        return result || { success: false, error: "Nessun risultato" };
      }

      // No existing WA tab — create one with send URL if phone number
      if (isPhoneNumber) {
        var numericPhone2 = cleanPhone.replace(/^\+/, "");
        var url = Config.WA_BASE + "/send?phone=" + numericPhone2 + "&text=" + encodeURIComponent(text);
        var tab = await TabManager.safeCreateTab(url, false);
        var loaded = await TabManager.waitForLoad(tab.id, 30000);
        if (!loaded) { await TabManager.safeRemoveTab(tab.id); return { success: false, error: "WA non caricato" }; }
        await TabManager.sleep(4000);
        await ensurePageHelpers(tab.id);
        var results2 = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: _pageSendUrlFallback,
        });
        return results2 && results2[0] ? results2[0].result : { success: false, error: "Nessun risultato" };
      }

      // Not a phone number and no existing tab — can't search
      return { success: false, error: "Nessuna tab WhatsApp aperta e il contatto non è un numero di telefono" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ══════════════════════════════════════════════
  // BACKFILL CHAT — injected page functions
  // ══════════════════════════════════════════════
  async function _pageOpenChatForBackfill(target) {
    const H = window.__waH;

    function currentChatMatches(name) {
      const header = H.qsDeep('#main header span[title]') || H.qsDeep('#main header [dir="auto"]') || H.qsDeep('[data-testid="conversation-header"] span[title]');
      const label = header ? ((header.getAttribute("title") || header.textContent || "").trim()) : "";
      return !!label && label.toLowerCase().includes(name.toLowerCase());
    }

    if (currentChatMatches(target)) return { success: true };

    const searchBox = H.qsDeep('[data-testid="chat-list-search"] [contenteditable="true"]') || H.qsDeep('[data-testid="chat-list-search"]') || H.qsDeep('[title*="earch" i]') || H.qsDeep('[title*="erca" i]') || H.qsDeep('[aria-label*="search" i]') || H.qsDeep('[aria-label*="cerca" i]');
    if (!searchBox) return { success: false, error: "Search box not found" };

    H.modernClearAndType(searchBox, target);
    await new Promise(function(r) { setTimeout(r, 1500); });

    const chats = H.qsaDeep('[data-testid="cell-frame-container"],[data-testid="chat-cell-wrapper"],[role="listitem"],[role="row"]');
    let clicked = false;
    for (const c of chats) {
      const titleEl = c.querySelector('span[title]');
      const title = titleEl ? (titleEl.getAttribute("title") || "") : "";
      if (title.toLowerCase().includes(target.toLowerCase())) {
        (c.closest('[data-testid="cell-frame-container"]') || c.closest('[data-testid="chat-cell-wrapper"]') || c).click();
        clicked = true; break;
      }
    }
    const clearBtn = H.qsDeep('[data-testid="search-input-clear"]') || H.qsDeep('[data-testid="x-alt"]') || H.qsDeep('[data-testid="search-close"]');
    if (clearBtn) clearBtn.click();
    if (!clicked) return { success: false, error: "Chat non trovata: " + target };
    await new Promise(function(r) { setTimeout(r, 2000); });
    return { success: true };
  }

  function _pageScrollAndRead(contact, lastText) {
    const H = window.__waH;
    const panel = H.qsDeep('[data-testid="conversation-panel-messages"]') || H.qsDeep('#main [role="application"]') || H.qsDeep("#main");
    if (!panel) return { success: false, error: "Panel not found" };
    const scrollContainer = panel.closest('[data-testid="conversation-panel-body"]') || panel.parentElement;
    if (scrollContainer) scrollContainer.scrollTop = 0;

    let msgEls = H.qsaDeep('[data-testid="msg-container"]');
    if (!msgEls.length) msgEls = H.qsaDeep('[role="row"][data-id]');
    const msgs = [];
    let hitLast = false;
    for (const el of msgEls) {
      const isOut = !!(el.querySelector('[data-testid="msg-dblcheck"]') || el.querySelector('[data-testid="msg-check"]'));
      const textEl = el.querySelector('[data-testid="balloon-text"] span') || el.querySelector('.selectable-text span') || el.querySelector('[dir="ltr"]');
      const text = textEl?.textContent?.trim() || "";
      if (!text) continue;
      if (lastText && text === lastText) { hitLast = true; break; }
      const timeEl = el.querySelector('[data-testid="msg-meta"] span') || el.querySelector('time');
      msgs.push({ direction: isOut ? "outbound" : "inbound", text: text, timestamp: timeEl?.textContent?.trim() || "", contact: isOut ? "me" : contact });
    }
    return { success: true, messages: msgs, foundLast: hitLast, totalInDom: msgEls.length };
  }

  // Page-only scroller: scrolls the panel up and signals if reached top
  function _pageScrollUpOnly() {
    const H = window.__waH;
    const panel = H.qsDeep('[data-testid="conversation-panel-messages"]') || H.qsDeep('#main [role="application"]') || H.qsDeep("#main");
    if (!panel) return { success: false, error: "Panel not found" };
    const scrollContainer = panel.closest('[data-testid="conversation-panel-body"]') || panel.parentElement;
    if (!scrollContainer) return { success: false, error: "Scroll container not found" };
    const before = scrollContainer.scrollTop;
    scrollContainer.scrollTop = 0;
    const after = scrollContainer.scrollTop;
    return { success: true, scrollBefore: before, scrollAfter: after, reachedTop: after === 0 && before === 0 };
  }

  async function backfillChat(contactName, lastKnownText, maxScrolls) {
    const MAX_SCROLLS = maxScrolls || 30;
    try {
      const r = await TabManager.getOrCreateWaTab();
      await TabManager.ensureTabVisibleAndWait(r.tab.id, 1200);
      await TabManager.sleep(r.reused ? 1500 : 5000);
      await ensurePageHelpers(r.tab.id);

      // 1. Open the target chat
      const openResult = await chrome.scripting.executeScript({
        target: { tabId: r.tab.id },
        args: [contactName],
        func: _pageOpenChatForBackfill,
      });
      const openRes = openResult && openResult[0] ? openResult[0].result : null;
      if (!openRes || !openRes.success) return openRes || { success: false, error: "Open failed" };

      const panelSelector = '[data-testid="conversation-panel-messages"], #main [role="application"], #main';
      const allMessages = [];
      const seen = new Set();
      const scrollDelays = [1, 2, 1.5, 3, 1, 2.5, 2, 1, 3, 1.5];
      let foundLast = false;
      let scrollIdx = 0;
      let optimusUnavailable = false;
      let plan = null;
      let cached = false;
      let planVersion = 0;
      let confidence = 0;

      // 2. Get an Optimus plan ONCE before the loop
      const initialSnap = await Optimus.snapshotPage(r.tab.id, panelSelector, 6, 3000);
      if (initialSnap && initialSnap.ok) {
        const planRes = await Optimus.getPlan({
          channel: "whatsapp",
          pageType: "thread",
          snapshot: initialSnap.snapshot,
          hash: initialSnap.hash,
          previousPlanFailed: false,
          failureContext: null,
        });
        if (planRes && planRes.success) {
          plan = planRes.plan || planRes;
          cached = !!planRes.cached;
          planVersion = planRes.plan_version || 0;
          confidence = planRes.confidence || 0;
        } else {
          optimusUnavailable = true;
        }
      } else {
        optimusUnavailable = true;
      }

      function pushUnique(msg) {
        const key = (msg.text || "") + "|" + (msg.timestamp || "");
        if (seen.has(key)) return false;
        seen.add(key);
        if (lastKnownText && msg.text === lastKnownText) return "stop";
        allMessages.push(msg);
        return true;
      }

      // 3. Loop: extract → scroll → extract
      for (scrollIdx = 0; scrollIdx < MAX_SCROLLS && !foundLast; scrollIdx++) {
        if (plan && !optimusUnavailable) {
          // Optimus extraction with cached plan
          let exec = await Optimus.executePlanInTab(r.tab.id, panelSelector, plan);
          let items = (exec && exec.items) || [];

          // Retry once with fresh plan if cache returned 0
          if (items.length === 0 && cached) {
            const freshSnap = await Optimus.snapshotPage(r.tab.id, panelSelector, 6, 3000);
            if (freshSnap && freshSnap.ok) {
              const freshRes = await Optimus.getPlan({
                channel: "whatsapp",
                pageType: "thread",
                snapshot: freshSnap.snapshot,
                hash: freshSnap.hash,
                previousPlanFailed: true,
                failureContext: "Cached plan returned 0 messages during backfill scroll " + scrollIdx + " for " + contactName,
              });
              if (freshRes && freshRes.success) {
                plan = freshRes.plan || freshRes;
                cached = !!freshRes.cached;
                planVersion = freshRes.plan_version || 0;
                confidence = freshRes.confidence || 0;
                exec = await Optimus.executePlanInTab(r.tab.id, panelSelector, plan);
                items = (exec && exec.items) || [];
              }
            }
            if (items.length === 0) break; // DOM no longer recognized
          }

          const mapped = mapOptimusThreadItems(items, contactName);
          for (const m of mapped) {
            const r2 = pushUnique(m);
            if (r2 === "stop") { foundLast = true; break; }
          }
        } else {
          // Legacy fallback: scroll-and-read with hardcoded selectors
          const scrollResult = await chrome.scripting.executeScript({
            target: { tabId: r.tab.id },
            args: [contactName, lastKnownText || ""],
            func: _pageScrollAndRead,
          });
          const res = scrollResult && scrollResult[0] ? scrollResult[0].result : null;
          if (!res || !res.success) break;
          if (res.messages) {
            for (const m of res.messages) {
              const r2 = pushUnique(m);
              if (r2 === "stop") { foundLast = true; break; }
            }
          }
          if (res.foundLast) { foundLast = true; break; }
        }

        if (foundLast) break;

        // 4. Scroll up to load older messages
        if (plan && !optimusUnavailable) {
          const scrollRes = await chrome.scripting.executeScript({
            target: { tabId: r.tab.id },
            func: _pageScrollUpOnly,
          });
          const sr = scrollRes && scrollRes[0] ? scrollRes[0].result : null;
          if (sr && sr.reachedTop) break;
        }
        await TabManager.sleep(scrollDelays[scrollIdx % scrollDelays.length] * 1000);
      }

      return {
        success: true,
        messages: allMessages,
        contact: contactName,
        foundLast: foundLast,
        scrollCount: scrollIdx,
        method: optimusUnavailable ? "legacy-dom" : (cached ? "optimus-cache" : "optimus-ai"),
        optimus: optimusUnavailable ? null : {
          cached: cached,
          planVersion: planVersion,
          confidence: confidence,
        },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ══════════════════════════════════════════════
  // DIAGNOSTIC
  // ══════════════════════════════════════════════
  async function diagnostic() {
    try {
      const r = await TabManager.getOrCreateWaTab();
      await TabManager.sleep(r.reused ? 1000 : 4000);
      let result = await Discovery.runDiscoveryScript(r.tab.id);
      const shouldHydrate = !r.tab.active && (!result || (!result.hasQR && !Discovery.hasRenderableWaUi(result) && (Discovery.hasShellSignals(result) || result.appLoaded)));
      if (shouldHydrate) {
        result = await TabManager.withTemporarilyVisibleTab(r.tab.id, async function () {
          return await Discovery.waitForRenderableWaUi(r.tab.id, 4, [900, 1400, 2000]);
        }) || result;
      }
      if (result) {
        result.success = true;
        return result;
      }
      return { success: false, error: "no result" };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  return {
    verifySession: verifySession,
    readUnreadMessages: readUnreadMessages,
    sendWhatsAppMessage: sendWhatsAppMessage,
    readThread: readThread,
    backfillChat: backfillChat,
    diagnostic: diagnostic,
  };
})();
globalThis.Actions = Actions;
