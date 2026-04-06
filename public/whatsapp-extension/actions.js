// ══════════════════════════════════════════════
// WhatsApp Extension v5.0 — Actions Module
// All business logic: verifySession, readUnread,
// sendMessage, readThread, backfill, diagnostic
// Uses modern input methods (no execCommand)
// ══════════════════════════════════════════════

var Actions = (function () {

  // ══════════════════════════════════════════════
  // SHARED: Modern text input helper (injected)
  // Replaces document.execCommand everywhere
  // ══════════════════════════════════════════════
  var MODERN_INPUT_HELPERS = `
    function modernClearAndType(el, text) {
      var input = el;
      if (el.querySelector) {
        input = el.querySelector('[contenteditable="true"], input') || el;
      }
      input.focus();
      if (typeof input.click === "function") input.click();

      // Select all text
      var sel = window.getSelection();
      if (sel && input.childNodes.length > 0) {
        var range = document.createRange();
        range.selectNodeContents(input);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      // Delete selection
      if (sel && !sel.isCollapsed) {
        sel.deleteFromDocument();
      }

      // Insert new text via InputEvent
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
        var nativeSetter = Object.getOwnPropertyDescriptor(
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
        // Use DataTransfer trick for React-controlled elements
        var dt = new DataTransfer();
        dt.setData("text/plain", text);
        el.dispatchEvent(new InputEvent("input", {
          inputType: "insertText", data: text, dataTransfer: dt,
          bubbles: true, composed: true
        }));
        // Fallback: if text didn't appear, set directly
        if (!el.textContent.includes(text)) {
          el.textContent = text;
          el.dispatchEvent(new InputEvent("input", {
            inputType: "insertText", data: text, bubbles: true, composed: true
          }));
        }
      }
    }
  `;

  // ══════════════════════════════════════════════
  // SHARED: Deep query helpers (injected into page)
  // ══════════════════════════════════════════════
  var DEEP_QUERY_HELPERS = `
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
    var _rootsCache = null;
    function getGlobalRoots() {
      if (_rootsCache) return _rootsCache;
      var roots = [document]; var seen = new Set([document]);
      scanShadowRoots(document, roots, seen);
      _rootsCache = roots; return roots;
    }
    function getNestedRoots(root) {
      var roots = [root]; var seen = new Set([root]);
      scanShadowRoots(root, roots, seen);
      return roots;
    }
    function queryAllFromRoots(roots, sel) {
      var out = []; var seen = new Set();
      for (var root of roots) {
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
          var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
          return !rect || rect.width > 0 || rect.height > 0;
        } catch (_) { return true; }
      });
    }
  `;

  // ══════════════════════════════════════════════
  // VERIFY SESSION
  // ══════════════════════════════════════════════
  async function verifySession() {
    try {
      var existing = await TabManager.getBestExistingWaTab();
      var waTab;
      if (existing) {
        waTab = existing;
        if (waTab.status !== "complete") await TabManager.waitForLoad(waTab.id, 8000);
      } else {
        var r = await TabManager.getOrCreateWaTab();
        waTab = r.tab;
        await TabManager.sleep(3000);
      }

      var result = await Discovery.waitForRenderableWaUi(waTab.id, 3, [1200, 1800]);
      var shouldHydrate = !waTab.active && (!result || (!result.hasQR && !Discovery.hasRenderableWaUi(result) && (Discovery.hasShellSignals(result) || result.appLoaded)));

      if (shouldHydrate) {
        result = await TabManager.withTemporarilyVisibleTab(waTab.id, async function () {
          return await Discovery.waitForRenderableWaUi(waTab.id, 4, [900, 1400, 2000]);
        }) || result;
      }

      var diag = Discovery.compactDiscovery(result);
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
  // READ UNREAD — multi-strategy
  // ══════════════════════════════════════════════
  async function readUnreadDOM(tabId) {
    await AiExtract.loadSchema();
    var schema = AiExtract.getSchema();

    var results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      args: [schema],
      func: new Function("schema", DEEP_QUERY_HELPERS + `
        var VERIFY_COUNT = 5;

        if (qsDeep('canvas[aria-label]') || qsDeep('[data-testid="qrcode"]') || qsDeep('[data-ref]'))
          return { success: false, error: "QR code visibile - accedi a WhatsApp Web" };

        var chatItems = [];
        var method = "none";

        // S1: Learned schema
        if (schema && schema.chatItem) {
          chatItems = filterVisible(qsaDeep(schema.chatItem));
          if (chatItems.length > 0) method = "learned:" + schema.chatItem;
        }
        if (chatItems.length === 0 && schema && schema.chatItemAlt) {
          chatItems = filterVisible(qsaDeep(schema.chatItemAlt));
          if (chatItems.length > 0) method = "learned-alt:" + schema.chatItemAlt;
        }

        // S2: data-testid
        if (chatItems.length === 0) {
          var testIdPatterns = ['cell-frame-container','chat-cell-wrapper','list-item','chatlist-item','chat-list-item'];
          for (var tid of testIdPatterns) {
            chatItems = filterVisible(qsaDeep('[data-testid="' + tid + '"]'));
            if (chatItems.length > 0) { method = "testid:" + tid; break; }
          }
        }

        // S3: role-based
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

        // S4: Container children
        if (chatItems.length === 0) {
          var containers = filterVisible(qsaDeep('[role="list"],[role="listbox"],[role="grid"],[role="navigation"]'));
          for (var cont of containers) {
            var vc = filterVisible(Array.from(cont.children || []));
            if (vc.length >= 3) { chatItems = vc; method = "container:" + cont.getAttribute("role"); break; }
          }
        }

        // S5: Heuristic
        if (chatItems.length === 0) {
          var allTitled = filterVisible(qsaDeep('span[title]'));
          var parentMap = new Map();
          for (var sp of allTitled) {
            var ancestor = sp.closest('[tabindex],[role="row"],[role="listitem"],[data-testid]');
            if (ancestor && !parentMap.has(ancestor)) parentMap.set(ancestor, true);
          }
          if (parentMap.size >= 3) { chatItems = Array.from(parentMap.keys()); method = "heuristic-titled-ancestors"; }
        }

        if (chatItems.length === 0) return { success: true, messages: [], scanned: 0, method: "none", error: "No chat items found" };

        var messages = [];
        var processed = 0;

        for (var i = 0; i < chatItems.length; i++) {
          var chat = chatItems[i];
          var badge = null, count = 0;

          badge = qsWithin(chat, '[data-testid="icon-unread-count"]') || qsWithin(chat, '[data-testid="unread-count"]');
          if (badge) count = parseInt(badge.textContent) || 1;

          if (!badge) {
            var ariaEls = qsaWithin(chat, 'span[aria-label]');
            for (var ae of ariaEls) {
              var label = (ae.getAttribute("aria-label") || "").toLowerCase();
              if (label.includes("unread") || label.includes("non lett") || label.includes("da leggere")) {
                count = parseInt(ae.textContent) || 1; badge = ae; break;
              }
            }
          }

          if (!badge) {
            var spans = qsaWithin(chat, 'span');
            for (var s of spans) {
              var txt = s.textContent.trim();
              if (txt && /^\\d+$/.test(txt) && txt.length <= 4) {
                var bg = window.getComputedStyle(s).backgroundColor;
                var parentBg = s.parentElement ? window.getComputedStyle(s.parentElement).backgroundColor : "";
                if ((bg + parentBg).match(/37,\\s*211|25d366|00a884|rgb\\(0,\\s*168|rgb\\(37/i)) {
                  count = parseInt(txt) || 1; badge = s; break;
                }
              }
            }
          }

          var isVerify = processed < VERIFY_COUNT;
          if (count === 0 && !isVerify) continue;

          var contactName = "Sconosciuto";
          var titleEl = qsWithin(chat, 'span[title][dir="auto"]') || qsWithin(chat, 'span[title]') || qsWithin(chat, '[data-testid="cell-frame-title"] span');
          if (titleEl) contactName = titleEl.getAttribute("title") || titleEl.textContent?.trim() || "Sconosciuto";

          var lastMessage = "";
          var msgEl = qsWithin(chat, '[data-testid="last-msg-status"]') || qsWithin(chat, '[data-testid="cell-frame-secondary"] span[title]') || qsWithin(chat, '[data-testid="cell-frame-secondary"] span') || qsWithin(chat, '[data-testid="last-msg"] span');
          if (!msgEl) {
            var allSpans = qsaWithin(chat, 'span');
            var candidates = [];
            for (var sp2 of allSpans) {
              var t = sp2.textContent?.trim();
              if (t && t.length > 3 && t !== contactName && !/^\\d+$/.test(t)) candidates.push(sp2);
            }
            if (candidates.length > 0) msgEl = candidates[candidates.length - 1];
          }
          if (msgEl) lastMessage = msgEl.textContent?.trim() || "";

          var time = new Date().toISOString();
          var timeEl = qsWithin(chat, '[data-testid="cell-frame-primary-detail"]') || qsWithin(chat, '[data-testid="msg-time"]') || qsWithin(chat, 'time');
          if (!timeEl) {
            var smallSpans = qsaWithin(chat, 'span');
            for (var ss of smallSpans) {
              var st = ss.textContent?.trim();
              if (st && /^\\d{1,2}[:.]\\ d{2}/.test(st)) { timeEl = ss; break; }
            }
          }
          if (timeEl) time = timeEl.textContent?.trim() || time;

          messages.push({ contact: contactName, lastMessage: lastMessage, time: time, unreadCount: count, isVerify: isVerify && count === 0 });
          processed++;
        }
        return { success: true, messages: messages, scanned: chatItems.length, method: method };
      `),
    });
    return results && results[0] ? results[0].result : { success: false, error: "No result" };
  }

  async function executeReadUnreadFlow(tabId) {
    var discovery = await Discovery.waitForRenderableWaUi(tabId, 4, [700, 1100, 1600]);
    if (discovery && discovery.hasQR) return { success: false, error: "WhatsApp Web non connesso - scansiona il QR code" };

    // Try AI first
    if (Config.hasConfig()) {
      var sidebarHtml = await AiExtract.grabSidebarHtml(tabId);
      if (sidebarHtml && sidebarHtml.length > 100) {
        var aiResult = await AiExtract.callAiExtract(sidebarHtml, "sidebar");
        if (aiResult && aiResult.success && aiResult.items && aiResult.items.length > 0) {
          return {
            success: true,
            messages: aiResult.items.map(function (item) {
              return { contact: item.contact || "Sconosciuto", lastMessage: item.lastMessage || "", time: item.time || new Date().toISOString(), unreadCount: item.unreadCount || 1 };
            }),
            scanned: 0, method: "ai", diagnostic: Discovery.compactDiscovery(discovery),
          };
        }
      }
    }

    // DOM fallback
    var domResult = await readUnreadDOM(tabId);
    if (domResult) {
      domResult.method = domResult.method || "dom";
      domResult.diagnostic = Discovery.compactDiscovery(discovery);
    }

    // If DOM found 0, try learning then retry
    if (domResult && domResult.messages && domResult.messages.length === 0 && Config.hasConfig()) {
      var learnResult = await AiExtract.learnDomSelectors(tabId);
      if (learnResult && learnResult.success) {
        var retryResult = await readUnreadDOM(tabId);
        if (retryResult) {
          retryResult.method = "dom-after-learn";
          retryResult.diagnostic = Discovery.compactDiscovery(discovery);
        }
        return retryResult;
      }
    }

    return domResult;
  }

  async function readUnreadMessages() {
    try {
      var r = await TabManager.getOrCreateWaTab();
      var tab = r.tab;
      await TabManager.sleep(r.reused ? 1500 : 5000);
      var preflight = await Discovery.runDiscoveryScript(tab.id);
      var shouldHydrate = !tab.active && (!preflight || (!preflight.hasQR && !Discovery.hasRenderableWaUi(preflight) && (Discovery.hasShellSignals(preflight) || preflight.appLoaded)));

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
  // SEND MESSAGE
  // ══════════════════════════════════════════════
  async function sendWhatsAppMessage(phone, text) {
    try {
      var existingTabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });

      if (existingTabs.length > 0) {
        var tabId = existingTabs[0].id;
        if (existingTabs[0].status !== "complete") await TabManager.waitForLoad(tabId, 10000);

        var results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: new Function("contact", "msg", MODERN_INPUT_HELPERS + DEEP_QUERY_HELPERS + `
            async function openChat(name) {
              var searchBox = qsDeep('[data-testid="chat-list-search"]') ||
                qsDeep('[contenteditable="true"][role="textbox"]') ||
                qsDeep('[title*="earch" i]') || qsDeep('[title*="erca" i]') ||
                qsDeep('[data-testid="search"]') || qsDeep('[aria-label*="search" i]') || qsDeep('[aria-label*="cerca" i]');

              if (searchBox) {
                var input = searchBox.querySelector ? (searchBox.querySelector('[contenteditable="true"]') || searchBox.querySelector('input') || searchBox) : searchBox;
                modernClearAndType(input, name);
                await new Promise(function(r) { setTimeout(r, 1500); });

                var chatResults = qsaDeep('[data-testid="cell-frame-container"],[data-testid="chat-cell-wrapper"],[role="listitem"],[role="row"],[role="option"]');
                if (!chatResults.length) chatResults = qsaDeep('span[title]');
                for (var i = 0; i < chatResults.length; i++) {
                  var el = chatResults[i];
                  var titleEl = el.querySelector ? el.querySelector('span[title]') : null;
                  var title = titleEl ? (titleEl.getAttribute('title') || '') : (el.getAttribute('title') || '');
                  if (title.toLowerCase().includes(name.toLowerCase())) {
                    var clickTarget = el.closest('[data-testid="cell-frame-container"]') || el.closest('[data-testid="chat-cell-wrapper"]') || el.closest('[role="listitem"]') || el.closest('[role="row"]') || el;
                    clickTarget.click();
                    await new Promise(function(r) { setTimeout(r, 800); });
                    var clearBtn = qsDeep('[data-testid="x-alt"]') || qsDeep('[data-testid="search-close"]') || qsDeep('[data-testid="search-input-clear"]');
                    if (clearBtn) clearBtn.click();
                    return true;
                  }
                }
                var esc = qsDeep('[data-testid="x-alt"]') || qsDeep('[data-testid="search-close"]') || qsDeep('[data-testid="search-input-clear"]');
                if (esc) esc.click();
              }
              return false;
            }

            var opened = await openChat(contact);

            // Retry with first name only if full name failed
            if (!opened && contact.includes(" ")) {
              var firstName = contact.split(" ")[0];
              if (firstName.length >= 2) {
                opened = await openChat(firstName);
              }
            }

            if (!opened) {
              var cleanPhone = contact.replace(/[^0-9]/g, "");
              if (cleanPhone.length >= 5) {
                window.location.href = "https://web.whatsapp.com/send?phone=" + cleanPhone + "&text=" + encodeURIComponent(msg);
                await new Promise(function(r) { setTimeout(r, 4000); });
              } else {
                return { success: false, error: "Contatto non trovato: " + contact };
              }
            }

            if (opened) {
              var inputBox = qsDeep('[data-testid="conversation-compose-box-input"]') || qsDeep('#main [contenteditable="true"]') || qsDeep('[role="textbox"][contenteditable="true"]');
              if (inputBox) {
                modernInsertText(inputBox, msg);
                await new Promise(function(r) { setTimeout(r, 300); });
              }
            }

            var start = Date.now();
            while (Date.now() - start < 10000) {
              var btn = qsDeep('span[data-icon="send"]') || qsDeep('[data-testid="send"]') || qsDeep('[data-testid="compose-btn-send"]') || qsDeep('button[aria-label*="end" i]') || qsDeep('button[aria-label*="nvia" i]');
              if (btn) {
                (btn.closest("button") || btn).click();
                await new Promise(function(r) { setTimeout(r, 1000); });
                return { success: true };
              }
              await new Promise(function(r) { setTimeout(r, 500); });
            }
            return { success: false, error: "Pulsante invio non trovato" };
          `),
          args: [phone, text],
        });
        return results && results[0] ? results[0].result : { success: false, error: "Nessun risultato" };
      }

      // No existing tab — use send URL
      var cleanPhone = phone.replace(/[^0-9]/g, "");
      var url = Config.WA_BASE + "/send?phone=" + cleanPhone + "&text=" + encodeURIComponent(text);
      var tab = await TabManager.safeCreateTab(url, false);
      var loaded = await TabManager.waitForLoad(tab.id, 30000);
      if (!loaded) { await TabManager.safeRemoveTab(tab.id); return { success: false, error: "WA non caricato" }; }
      await TabManager.sleep(3000);

      var results2 = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: new Function(DEEP_QUERY_HELPERS + `
          var start = Date.now();
          while (Date.now() - start < 15000) {
            if (qsDeep('canvas[aria-label]') || qsDeep('[data-testid="qrcode"]'))
              return { success: false, error: "Non connesso a WhatsApp Web" };
            var btn = qsDeep('span[data-icon="send"]') || qsDeep('[data-testid="send"]') || qsDeep('[data-testid="compose-btn-send"]') || qsDeep('button[aria-label*="end" i]') || qsDeep('button[aria-label*="nvia" i]');
            if (btn) {
              (btn.closest("button") || btn).click();
              await new Promise(function(r) { setTimeout(r, 1500); });
              return { success: true };
            }
            await new Promise(function(r) { setTimeout(r, 500); });
          }
          return { success: false, error: "Pulsante invio non trovato" };
        `),
      });
      var result2 = results2 && results2[0] ? results2[0].result : null;
      await TabManager.sleep(500);
      await TabManager.safeRemoveTab(tab.id);
      return result2 || { success: false, error: "Nessun risultato" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ══════════════════════════════════════════════
  // READ THREAD
  // ══════════════════════════════════════════════
  async function readThread(contactName, maxMessages) {
    try {
      var r = await TabManager.getOrCreateWaTab();
      await TabManager.sleep(r.reused ? 1500 : 5000);

      var results = await chrome.scripting.executeScript({
        target: { tabId: r.tab.id },
        args: [contactName],
        func: new Function("target", MODERN_INPUT_HELPERS + DEEP_QUERY_HELPERS + `
          function currentChatMatches(name) {
            var header = qsDeep('#main header span[title]') || qsDeep('#main header [dir="auto"]') || qsDeep('[data-testid="conversation-header"] span[title]');
            var label = header ? ((header.getAttribute("title") || header.textContent || "").trim()) : "";
            return !!label && label.toLowerCase().includes(name.toLowerCase());
          }

          if (!currentChatMatches(target)) {
            var searchBox = qsDeep('[data-testid="chat-list-search"] [contenteditable="true"]') || qsDeep('[data-testid="chat-list-search"]') || qsDeep('[title*="earch" i]') || qsDeep('[title*="erca" i]') || qsDeep('[data-testid="search"]') || qsDeep('[aria-label*="search" i]') || qsDeep('[aria-label*="cerca" i]') || qsDeep('[role="textbox"][contenteditable="true"]');
            if (!searchBox) return { success: false, error: "Search box not found" };
            modernClearAndType(searchBox, target);
            await new Promise(function(r) { setTimeout(r, 1500); });

            var chats = qsaDeep('[data-testid="cell-frame-container"],[data-testid="chat-cell-wrapper"],[role="listitem"],[role="row"]');
            var clicked = false;
            for (var c of chats) {
              var titleEl = c.querySelector('span[title]');
              var title = titleEl ? (titleEl.getAttribute("title") || "") : "";
              if (title.toLowerCase().includes(target.toLowerCase())) {
                (c.closest('[data-testid="cell-frame-container"]') || c.closest('[data-testid="chat-cell-wrapper"]') || c).click();
                clicked = true; break;
              }
            }
            if (!clicked) return { success: false, error: "Chat non trovata: " + target };

            var clearBtn = qsDeep('[data-testid="search-input-clear"]') || qsDeep('[data-testid="x-alt"]') || qsDeep('[data-testid="search-close"]');
            if (clearBtn) clearBtn.click();
            await new Promise(function(r) { setTimeout(r, 2000); });
          }

          var panel = qsDeep('[data-testid="conversation-panel-messages"]') || qsDeep('#main [role="application"]') || qsDeep('#main');
          return { success: true, html: panel ? panel.outerHTML : null };
        `),
      });

      var scriptResult = results && results[0] ? results[0].result : null;
      if (!scriptResult || !scriptResult.success) return scriptResult || { success: false, error: "Script error" };

      // Try AI extraction
      if (scriptResult.html && Config.hasConfig()) {
        var aiResult = await AiExtract.callAiExtract(scriptResult.html, "thread");
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
      var domResults = await chrome.scripting.executeScript({
        target: { tabId: r.tab.id },
        args: [contactName, maxMessages || 50],
        func: new Function("target", "limit", DEEP_QUERY_HELPERS + `
          var msgEls = qsaDeep('[data-testid="msg-container"]');
          if (!msgEls.length) msgEls = qsaDeep('[role="row"][data-id]');
          var msgs = [];
          var items = Array.from(msgEls).slice(-limit);
          for (var el of items) {
            var isOut = !!(el.querySelector('[data-testid="msg-dblcheck"]') || el.querySelector('[data-testid="msg-check"]'));
            var textEl = el.querySelector('[data-testid="balloon-text"] span') || el.querySelector('.selectable-text span') || el.querySelector('[dir="ltr"]');
            var text = textEl?.textContent?.trim() || "";
            if (!text) continue;
            var timeEl = el.querySelector('[data-testid="msg-meta"] span') || el.querySelector('time');
            msgs.push({ direction: isOut ? "outbound" : "inbound", text: text, timestamp: timeEl?.textContent?.trim() || "", contact: isOut ? "me" : target });
          }
          return { success: true, messages: msgs, contact: target, method: "dom" };
        `),
      });
      return domResults && domResults[0] ? domResults[0].result : { success: false, error: "DOM fallback failed" };
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
      var r = await TabManager.getOrCreateWaTab();
      await TabManager.sleep(r.reused ? 1500 : 5000);

      var openResult = await chrome.scripting.executeScript({
        target: { tabId: r.tab.id },
        args: [contactName],
        func: new Function("target", MODERN_INPUT_HELPERS + DEEP_QUERY_HELPERS + `
          function currentChatMatches(name) {
            var header = qsDeep('#main header span[title]') || qsDeep('#main header [dir="auto"]') || qsDeep('[data-testid="conversation-header"] span[title]');
            var label = header ? ((header.getAttribute("title") || header.textContent || "").trim()) : "";
            return !!label && label.toLowerCase().includes(name.toLowerCase());
          }

          if (currentChatMatches(target)) return { success: true };

          var searchBox = qsDeep('[data-testid="chat-list-search"] [contenteditable="true"]') || qsDeep('[data-testid="chat-list-search"]') || qsDeep('[title*="earch" i]') || qsDeep('[title*="erca" i]') || qsDeep('[aria-label*="search" i]') || qsDeep('[aria-label*="cerca" i]');
          if (!searchBox) return { success: false, error: "Search box not found" };

          modernClearAndType(searchBox, target);
          await new Promise(function(r) { setTimeout(r, 1500); });

          var chats = qsaDeep('[data-testid="cell-frame-container"],[data-testid="chat-cell-wrapper"],[role="listitem"],[role="row"]');
          var clicked = false;
          for (var c of chats) {
            var titleEl = c.querySelector('span[title]');
            var title = titleEl ? (titleEl.getAttribute("title") || "") : "";
            if (title.toLowerCase().includes(target.toLowerCase())) {
              (c.closest('[data-testid="cell-frame-container"]') || c.closest('[data-testid="chat-cell-wrapper"]') || c).click();
              clicked = true; break;
            }
          }
          var clearBtn = qsDeep('[data-testid="search-input-clear"]') || qsDeep('[data-testid="x-alt"]') || qsDeep('[data-testid="search-close"]');
          if (clearBtn) clearBtn.click();
          if (!clicked) return { success: false, error: "Chat non trovata: " + target };
          await new Promise(function(r) { setTimeout(r, 2000); });
          return { success: true };
        `),
      });

      var openRes = openResult && openResult[0] ? openResult[0].result : null;
      if (!openRes || !openRes.success) return openRes || { success: false, error: "Open failed" };

      var allMessages = [];
      var foundLast = false;
      var scrollDelays = [1, 2, 1.5, 3, 1, 2.5, 2, 1, 3, 1.5];

      for (var scrollIdx = 0; scrollIdx < MAX_SCROLLS && !foundLast; scrollIdx++) {
        var scrollResult = await chrome.scripting.executeScript({
          target: { tabId: r.tab.id },
          args: [contactName, lastKnownText || ""],
          func: new Function("contact", "lastText", DEEP_QUERY_HELPERS + `
            var panel = qsDeep('[data-testid="conversation-panel-messages"]') || qsDeep('#main [role="application"]') || qsDeep("#main");
            if (!panel) return { success: false, error: "Panel not found" };
            var scrollContainer = panel.closest('[data-testid="conversation-panel-body"]') || panel.parentElement;
            if (scrollContainer) scrollContainer.scrollTop = 0;

            var msgEls = qsaDeep('[data-testid="msg-container"]');
            if (!msgEls.length) msgEls = qsaDeep('[role="row"][data-id]');
            var msgs = [];
            var hitLast = false;
            for (var el of msgEls) {
              var isOut = !!(el.querySelector('[data-testid="msg-dblcheck"]') || el.querySelector('[data-testid="msg-check"]'));
              var textEl = el.querySelector('[data-testid="balloon-text"] span') || el.querySelector('.selectable-text span') || el.querySelector('[dir="ltr"]');
              var text = textEl?.textContent?.trim() || "";
              if (!text) continue;
              if (lastText && text === lastText) { hitLast = true; break; }
              var timeEl = el.querySelector('[data-testid="msg-meta"] span') || el.querySelector('time');
              msgs.push({ direction: isOut ? "outbound" : "inbound", text: text, timestamp: timeEl?.textContent?.trim() || "", contact: isOut ? "me" : contact });
            }
            return { success: true, messages: msgs, foundLast: hitLast, totalInDom: msgEls.length };
          `),
        });

        var res = scrollResult && scrollResult[0] ? scrollResult[0].result : null;
        if (!res || !res.success) break;
        if (res.messages && res.messages.length) {
          for (var m of res.messages) {
            var isDup = allMessages.some(function (existing) { return existing.text === m.text && existing.timestamp === m.timestamp; });
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
      var r = await TabManager.getOrCreateWaTab();
      await TabManager.sleep(r.reused ? 1000 : 4000);
      var result = await Discovery.runDiscoveryScript(r.tab.id);
      var shouldHydrate = !r.tab.active && (!result || (!result.hasQR && !Discovery.hasRenderableWaUi(result) && (Discovery.hasShellSignals(result) || result.appLoaded)));
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
