// ══════════════════════════════════════════════
// WhatsApp Extension v5.1 — Actions Module
// CSP-compliant: no new Function() / eval
// Uses inject-once helpers pattern
// ══════════════════════════════════════════════

const Actions = (function () {

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
    const VERIFY_COUNT = 5;

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

      const isVerify = processed < VERIFY_COUNT;
      if (count === 0 && !isVerify) continue;

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

      messages.push({ contact: contactName, lastMessage: lastMessage, time: time, unreadCount: count, isVerify: isVerify && count === 0 });
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

  // ── Optimus-first: try AI extraction plan, fallback to legacy on 503 ──
  async function tryOptimusReadUnread(tabId, previousFailed, failureContext) {
    // 1. snapshot the sidebar
    const sidebarSelector = '[data-tab="3"], #pane-side, [role="grid"]';
    const snap = await Optimus.snapshotPage(tabId, sidebarSelector, 6, 3000);
    if (!snap || !snap.ok) return { success: false, error: snap && snap.error || "snapshot_failed", optimusUnavailable: false };

    // 2. ask plan via webapp bridge
    const planRes = await Optimus.getPlan({
      channel: "whatsapp",
      pageType: "sidebar",
      snapshot: snap.snapshot,
      hash: snap.hash,
      previousPlanFailed: !!previousFailed,
      failureContext: failureContext || null,
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

  async function executeReadUnreadFlow(tabId) {
    const discovery = await Discovery.waitForRenderableWaUi(tabId, 4, [700, 1100, 1600]);
    if (discovery && discovery.hasQR) return { success: false, error: "WhatsApp Web non connesso - scansiona il QR code" };

    // ── Optimus first ──
    let optimus = await tryOptimusReadUnread(tabId, false, null);
    if (optimus.success && optimus.items.length === 0 && optimus.cached) {
      // retry with fresh plan
      optimus = await tryOptimusReadUnread(
        tabId, true,
        "Cached plan returned 0 items from sidebar"
      );
    }

    if (optimus.success) {
      const messages = optimus.items.map(function (it) {
        return {
          contact: it.contact_name || it.thread_name || "Sconosciuto",
          lastMessage: it.last_message || "",
          time: it.timestamp || new Date().toISOString(),
          unreadCount: it.unread_indicator ? (parseInt(it.unread_indicator, 10) || 1) : 0,
        };
      });
      return {
        success: true,
        messages: messages,
        scanned: optimus.candidates,
        method: optimus.cached ? "optimus-cache" : "optimus-ai",
        optimus: {
          cached: optimus.cached,
          planVersion: optimus.planVersion,
          confidence: optimus.confidence,
          latencyMs: optimus.latencyMs,
          dropped: optimus.dropped,
        },
        diagnostic: Discovery.compactDiscovery(discovery),
      };
    }

    // ── Legacy fallback (only if Optimus is unavailable, e.g. 503/no-app-tab) ──
    if (!optimus.optimusUnavailable) {
      // Optimus reachable but failed structurally — keep the failure
      return { success: false, error: optimus.error || "optimus_failed", method: "optimus-error" };
    }

    // Try legacy AI extraction first
    if (Config.hasConfig()) {
      const sidebarHtml = await AiExtract.grabSidebarHtml(tabId);
      if (sidebarHtml && sidebarHtml.length > 100) {
        const aiResult = await AiExtract.callAiExtract(sidebarHtml, "sidebar");
        if (aiResult && aiResult.success && aiResult.items && aiResult.items.length > 0) {
          return {
            success: true,
            messages: aiResult.items.map(function (item) {
              return { contact: item.contact || "Sconosciuto", lastMessage: item.lastMessage || "", time: item.time || new Date().toISOString(), unreadCount: item.unreadCount || 1 };
            }),
            scanned: 0, method: "legacy-ai", diagnostic: Discovery.compactDiscovery(discovery),
          };
        }
      }
    }

    // Final fallback: hardcoded DOM strategies (S1-S5)
    const domResult = await readUnreadDOM(tabId);
    if (domResult) {
      domResult.method = "legacy-dom:" + (domResult.method || "unknown");
      domResult.diagnostic = Discovery.compactDiscovery(discovery);
    }
    return domResult;
  }

  async function readUnreadMessages() {
    try {
      const r = await TabManager.getOrCreateWaTab();
      const tab = r.tab;
      await TabManager.sleep(r.reused ? 1500 : 5000);
      const preflight = await Discovery.runDiscoveryScript(tab.id);
      const shouldHydrate = !tab.active && (!preflight || (!preflight.hasQR && !Discovery.hasRenderableWaUi(preflight) && (Discovery.hasShellSignals(preflight) || preflight.appLoaded)));

      if (shouldHydrate) {
        return await TabManager.withTemporarilyVisibleTab(tab.id, async function () {
          return await executeReadUnreadFlow(tab.id);
        });
      }
      return await executeReadUnreadFlow(tab.id);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ══════════════════════════════════════════════
  // SEND MESSAGE — injected page function
  // ══════════════════════════════════════════════
  async function _pageSendWhatsApp(contact, msg) {
    const H = window.__waH;

    async function openChat(name) {
      const searchBox = H.qsDeep('[data-testid="chat-list-search"]') ||
        H.qsDeep('[contenteditable="true"][role="textbox"]') ||
        H.qsDeep('[title*="earch" i]') || H.qsDeep('[title*="erca" i]') ||
        H.qsDeep('[data-testid="search"]') || H.qsDeep('[aria-label*="search" i]') || H.qsDeep('[aria-label*="cerca" i]');

      if (searchBox) {
        const input = searchBox.querySelector ? (searchBox.querySelector('[contenteditable="true"]') || searchBox.querySelector('input') || searchBox) : searchBox;
        H.modernClearAndType(input, name);
        await new Promise(function(r) { setTimeout(r, 1500); });

        let chatResults = H.qsaDeep('[data-testid="cell-frame-container"],[data-testid="chat-cell-wrapper"],[role="listitem"],[role="row"],[role="option"]');
        if (!chatResults.length) chatResults = H.qsaDeep('span[title]');
        for (let i = 0; i < chatResults.length; i++) {
          const el = chatResults[i];
          const titleEl = el.querySelector ? el.querySelector('span[title]') : null;
          const title = titleEl ? (titleEl.getAttribute('title') || '') : (el.getAttribute('title') || '');
          if (title.toLowerCase().includes(name.toLowerCase())) {
            const clickTarget = el.closest('[data-testid="cell-frame-container"]') || el.closest('[data-testid="chat-cell-wrapper"]') || el.closest('[role="listitem"]') || el.closest('[role="row"]') || el;
            clickTarget.click();
            await new Promise(function(r) { setTimeout(r, 800); });
            const clearBtn = H.qsDeep('[data-testid="x-alt"]') || H.qsDeep('[data-testid="search-close"]') || H.qsDeep('[data-testid="search-input-clear"]');
            if (clearBtn) clearBtn.click();
            return true;
          }
        }
        const esc = H.qsDeep('[data-testid="x-alt"]') || H.qsDeep('[data-testid="search-close"]') || H.qsDeep('[data-testid="search-input-clear"]');
        if (esc) esc.click();
      }
      return false;
    }

    // Step 0: Check if the target chat is already open
    let opened = false;
    const currentHeader = H.qsDeep('#main header span[title]') ||
      H.qsDeep('[data-testid="conversation-info-header-chat-title"]') ||
      H.qsDeep('#main header [role="button"] span');
    if (currentHeader) {
      const headerTitle = (currentHeader.getAttribute('title') || currentHeader.textContent || '').trim().toLowerCase();
      const contactClean = contact.trim().toLowerCase();
      if (headerTitle && contactClean && (headerTitle.includes(contactClean) || contactClean.includes(headerTitle))) {
        opened = true;
      }
    }

    if (!opened) {
      opened = await openChat(contact);
    }

    // Retry with first name only if full name failed
    if (!opened && contact.includes(" ")) {
      const firstName = contact.split(" ")[0];
      if (firstName.length >= 2) {
        opened = await openChat(firstName);
      }
    }

    if (!opened) {
      const cleanPhone = contact.replace(/[^0-9]/g, "");
      if (cleanPhone.length >= 5) {
        window.location.href = "https://web.whatsapp.com/send?phone=" + cleanPhone + "&text=" + encodeURIComponent(msg);
        await new Promise(function(r) { setTimeout(r, 4000); });
      } else {
        return { success: false, error: "Contatto non trovato: " + contact };
      }
    }

    if (opened) {
      const inputBox = H.qsDeep('[data-testid="conversation-compose-box-input"]') || H.qsDeep('#main [contenteditable="true"]') || H.qsDeep('[role="textbox"][contenteditable="true"]');
      if (inputBox) {
        H.modernInsertText(inputBox, msg);
        await new Promise(function(r) { setTimeout(r, 300); });
      }
    }

    const start = Date.now();
    while (Date.now() - start < 10000) {
      const btn = H.qsDeep('span[data-icon="send"]') || H.qsDeep('[data-testid="send"]') || H.qsDeep('[data-testid="compose-btn-send"]') || H.qsDeep('button[aria-label*="end" i]') || H.qsDeep('button[aria-label*="nvia" i]');
      if (btn) {
        (btn.closest("button") || btn).click();
        await new Promise(function(r) { setTimeout(r, 1000); });
        return { success: true };
      }
      await new Promise(function(r) { setTimeout(r, 500); });
    }
    return { success: false, error: "Pulsante invio non trovato" };
  }

  // Page function for URL-based send (no existing tab)
  async function _pageSendUrlFallback() {
    const H = window.__waH;
    const start = Date.now();
    while (Date.now() - start < 15000) {
      if (H.qsDeep('canvas[aria-label]') || H.qsDeep('[data-testid="qrcode"]'))
        return { success: false, error: "Non connesso a WhatsApp Web" };
      const btn = H.qsDeep('span[data-icon="send"]') || H.qsDeep('[data-testid="send"]') || H.qsDeep('[data-testid="compose-btn-send"]') || H.qsDeep('button[aria-label*="end" i]') || H.qsDeep('button[aria-label*="nvia" i]');
      if (btn) {
        (btn.closest("button") || btn).click();
        await new Promise(function(r) { setTimeout(r, 1500); });
        return { success: true };
      }
      await new Promise(function(r) { setTimeout(r, 500); });
    }
    return { success: false, error: "Pulsante invio non trovato" };
  }

  async function sendWhatsAppMessage(phone, text) {
    try {
      const existingTabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });

      if (existingTabs.length > 0) {
        const tabId = existingTabs[0].id;
        if (existingTabs[0].status !== "complete") await TabManager.waitForLoad(tabId, 10000);
        await ensurePageHelpers(tabId);

        const results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          args: [phone, text],
          func: _pageSendWhatsApp,
        });
        return results && results[0] ? results[0].result : { success: false, error: "Nessun risultato" };
      }

      // No existing tab — use send URL
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      const url = Config.WA_BASE + "/send?phone=" + cleanPhone + "&text=" + encodeURIComponent(text);
      const tab = await TabManager.safeCreateTab(url, false);
      const loaded = await TabManager.waitForLoad(tab.id, 30000);
      if (!loaded) { await TabManager.safeRemoveTab(tab.id); return { success: false, error: "WA non caricato" }; }
      await TabManager.sleep(3000);
      await ensurePageHelpers(tab.id);

      const results2 = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: _pageSendUrlFallback,
      });
      const result2 = results2 && results2[0] ? results2[0].result : null;
      await TabManager.sleep(500);
      await TabManager.safeRemoveTab(tab.id);
      return result2 || { success: false, error: "Nessun risultato" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ══════════════════════════════════════════════
  // READ THREAD — injected page functions
  // ══════════════════════════════════════════════
  async function _pageOpenAndReadThread(target) {
    const H = window.__waH;

    function currentChatMatches(name) {
      const header = H.qsDeep('#main header span[title]') || H.qsDeep('#main header [dir="auto"]') || H.qsDeep('[data-testid="conversation-header"] span[title]');
      const label = header ? ((header.getAttribute("title") || header.textContent || "").trim()) : "";
      return !!label && label.toLowerCase().includes(name.toLowerCase());
    }

    if (!currentChatMatches(target)) {
      const searchBox = H.qsDeep('[data-testid="chat-list-search"] [contenteditable="true"]') || H.qsDeep('[data-testid="chat-list-search"]') || H.qsDeep('[title*="earch" i]') || H.qsDeep('[title*="erca" i]') || H.qsDeep('[data-testid="search"]') || H.qsDeep('[aria-label*="search" i]') || H.qsDeep('[aria-label*="cerca" i]') || H.qsDeep('[role="textbox"][contenteditable="true"]');
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
      if (!clicked) return { success: false, error: "Chat non trovata: " + target };

      const clearBtn = H.qsDeep('[data-testid="search-input-clear"]') || H.qsDeep('[data-testid="x-alt"]') || H.qsDeep('[data-testid="search-close"]');
      if (clearBtn) clearBtn.click();
      await new Promise(function(r) { setTimeout(r, 2000); });
    }

    const panel = H.qsDeep('[data-testid="conversation-panel-messages"]') || H.qsDeep('#main [role="application"]') || H.qsDeep('#main');
    return { success: true, html: panel ? panel.outerHTML : null };
  }

  function _pageDomReadMessages(target, limit) {
    const H = window.__waH;
    let msgEls = H.qsaDeep('[data-testid="msg-container"]');
    if (!msgEls.length) msgEls = H.qsaDeep('[role="row"][data-id]');
    const msgs = [];
    const items = Array.from(msgEls).slice(-limit);
    for (const el of items) {
      const isOut = !!(el.querySelector('[data-testid="msg-dblcheck"]') || el.querySelector('[data-testid="msg-check"]'));
      const textEl = el.querySelector('[data-testid="balloon-text"] span') || el.querySelector('.selectable-text span') || el.querySelector('[dir="ltr"]');
      const text = textEl?.textContent?.trim() || "";
      if (!text) continue;
      const timeEl = el.querySelector('[data-testid="msg-meta"] span') || el.querySelector('time');
      msgs.push({ direction: isOut ? "outbound" : "inbound", text: text, timestamp: timeEl?.textContent?.trim() || "", contact: isOut ? "me" : target });
    }
    return { success: true, messages: msgs, contact: target, method: "dom" };
  }

  async function readThread(contactName, maxMessages) {
    try {
      const r = await TabManager.getOrCreateWaTab();
      await TabManager.sleep(r.reused ? 1500 : 5000);
      await ensurePageHelpers(r.tab.id);

      const results = await chrome.scripting.executeScript({
        target: { tabId: r.tab.id },
        args: [contactName],
        func: _pageOpenAndReadThread,
      });

      const scriptResult = results && results[0] ? results[0].result : null;
      if (!scriptResult || !scriptResult.success) return scriptResult || { success: false, error: "Script error" };

      // Try AI extraction
      if (scriptResult.html && Config.hasConfig()) {
        const aiResult = await AiExtract.callAiExtract(scriptResult.html, "thread");
        if (aiResult && aiResult.success && aiResult.items && aiResult.items.length > 0) {
          return {
            success: true,
            messages: aiResult.items.map(function (m) {
              return { direction: m.direction || "inbound", text: m.text || "", timestamp: m.timestamp || "", contact: m.contact || contactName };
            }),
            contact: contactName, method: "ai",
          };
        }
      }

      // DOM fallback
      const domResults = await chrome.scripting.executeScript({
        target: { tabId: r.tab.id },
        args: [contactName, maxMessages || 50],
        func: _pageDomReadMessages,
      });
      return domResults && domResults[0] ? domResults[0].result : { success: false, error: "DOM fallback failed" };
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

  async function backfillChat(contactName, lastKnownText, maxScrolls) {
    const MAX_SCROLLS = maxScrolls || 30;
    try {
      const r = await TabManager.getOrCreateWaTab();
      await TabManager.sleep(r.reused ? 1500 : 5000);
      await ensurePageHelpers(r.tab.id);

      const openResult = await chrome.scripting.executeScript({
        target: { tabId: r.tab.id },
        args: [contactName],
        func: _pageOpenChatForBackfill,
      });

      const openRes = openResult && openResult[0] ? openResult[0].result : null;
      if (!openRes || !openRes.success) return openRes || { success: false, error: "Open failed" };

      const allMessages = [];
      let foundLast = false;
      const scrollDelays = [1, 2, 1.5, 3, 1, 2.5, 2, 1, 3, 1.5];
      let scrollIdx;

      for (scrollIdx = 0; scrollIdx < MAX_SCROLLS && !foundLast; scrollIdx++) {
        const scrollResult = await chrome.scripting.executeScript({
          target: { tabId: r.tab.id },
          args: [contactName, lastKnownText || ""],
          func: _pageScrollAndRead,
        });

        const res = scrollResult && scrollResult[0] ? scrollResult[0].result : null;
        if (!res || !res.success) break;
        if (res.messages && res.messages.length) {
          for (const m of res.messages) {
            const isDup = allMessages.some(function (existing) { return existing.text === m.text && existing.timestamp === m.timestamp; });
            if (!isDup) allMessages.push(m);
          }
        }
        if (res.foundLast) { foundLast = true; break; }
        await TabManager.sleep(scrollDelays[scrollIdx % scrollDelays.length] * 1000);
      }

      return { success: true, messages: allMessages, contact: contactName, foundLast: foundLast, scrollCount: scrollIdx };
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
