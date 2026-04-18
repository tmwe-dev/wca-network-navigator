// ══════════════════════════════════════════════════
// LinkedIn Extension — High-Level Actions Module
// Orchestrates hybrid operations into user-facing actions
// ══════════════════════════════════════════════════

var Actions = globalThis.Actions || (function () {

  async function extractProfileByUrl(url) {
    if (!url) return Config.errorResponse(Config.ERROR.EXTRACTION_FAILED, "URL mancante");
    const tab = await TabManager.getLinkedInTab(url);
    await TabManager.ensureTabVisibleAndWait(tab.id, 1200);
    return await HybridOps.extractProfile(tab.id);
  }

  async function sendLinkedInMessage(profileUrl, message) {
    if (!profileUrl) return Config.errorResponse(Config.ERROR.MESSAGE_FAILED, "URL profilo mancante");
    if (!message) return Config.errorResponse(Config.ERROR.MESSAGE_FAILED, "Messaggio mancante");
    const tab = await TabManager.getLinkedInTab(profileUrl.replace(/\/$/, ""));
    await TabManager.ensureTabVisibleAndWait(tab.id, 1200);
    const clickResult = await HybridOps.clickMessage(tab.id);
    if (!clickResult || !clickResult.success) return Config.errorResponse(Config.ERROR.MESSAGE_FAILED, (clickResult && clickResult.error) || "Message button not found");
    await TabManager.sleep(3000);
    return await HybridOps.sendMessage(tab.id, message);
  }

  async function sendConnectionRequest(profileUrl, note) {
    if (!profileUrl) return Config.errorResponse(Config.ERROR.CONNECT_FAILED, "URL profilo mancante");
    const tab = await TabManager.getLinkedInTab(profileUrl.replace(/\/$/, ""));
    await TabManager.ensureTabVisibleAndWait(tab.id, 1200);
    const clickResult = await HybridOps.clickConnect(tab.id);
    if (!clickResult || !clickResult.success) return Config.errorResponse(Config.ERROR.CONNECT_FAILED, (clickResult && clickResult.error) || "Connect button not found");
    await TabManager.sleep(2000);
    if (note && note.trim()) {
      return await HybridOps.addNote(tab.id, note);
    }
    // Send without note
    try {
      const sendRes = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          const btn = Array.from(document.querySelectorAll("button")).find(function (el) {
            return /send without|invia senza|send now/i.test(el.textContent.trim());
          }) || Array.from(document.querySelectorAll("button")).find(function (el) {
            return /^(send|invia)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
          });
          if (btn) { btn.click(); return { success: true }; }
          return { success: false, error: "Send button not found" };
        },
      });
      return (sendRes[0] && sendRes[0].result) || { success: false, error: "Send failed" };
    } catch (e) { return Config.errorResponse(Config.ERROR.CONNECT_FAILED, e.message); }
  }

  async function searchProfile(query) {
    if (!query) return Config.errorResponse(Config.ERROR.SEARCH_FAILED, "Query mancante");
    const searchUrl = "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(query);
    const tab = await TabManager.getLinkedInTab(searchUrl);
    await TabManager.ensureTabVisibleAndWait(tab.id, 1200);
    await TabManager.sleep(3000);
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          const allLinks = document.querySelectorAll("a[href*='/in/']");
          for (let i = 0; i < allLinks.length; i++) {
            const href = allLinks[i].href || "";
            if (/linkedin\.com\/in\/[^/]+/.test(href) && !/\/in\/miniprofile/.test(href) && !/\/in\/ACo/.test(href)) {
              const cleanUrl = href.split("?")[0].replace(/\/$/, "");
              const container = allLinks[i].closest("li, [data-chameleon-result-urn]");
              let name = "";
              let headline = "";
              if (container) {
                const nameEl = container.querySelector("span[aria-hidden='true']");
                if (nameEl) name = nameEl.textContent.trim();
                if (!name) { const dirEl = container.querySelector("h3 span[dir='ltr'], a span[dir='ltr'], span[dir='ltr']"); if (dirEl) name = dirEl.textContent.trim(); }
                if (!name && allLinks[i].textContent) { const lt = allLinks[i].textContent.replace(/\s+/g, " ").trim(); if (lt.length > 1 && lt.length < 80) name = lt; }
                if (!name) { const h = container.querySelector("h3, h4"); if (h) name = h.textContent.replace(/\s+/g, " ").trim(); }
                const secEl = container.querySelector("div[class*='subtitle'], p[class*='summary']");
                if (secEl) headline = secEl.textContent.replace(/\s+/g, " ").trim().substring(0, 200);
                if (!headline) { const ps = container.querySelectorAll("p, div[class*='t-']"); for (let pp = 0; pp < ps.length; pp++) { const pt = ps[pp].textContent.replace(/\s+/g, " ").trim(); if (pt && pt !== name && pt.length > 3 && pt.length < 200) { headline = pt; break; } } }
              }
              if (!name) { const al = allLinks[i].getAttribute("aria-label") || ""; if (al.length > 1) name = al.split(",")[0].trim(); }
              return { profileUrl: cleanUrl, name: name, headline: headline };
            }
          }
          return null;
        },
      });
      const profileData = results[0] && results[0].result;
      if (profileData && profileData.profileUrl) return Config.successResponse({ profile: profileData });
      return Config.errorResponse(Config.ERROR.SEARCH_FAILED, "Nessun profilo trovato per: " + query);
    } catch (err) { return Config.errorResponse(Config.ERROR.SEARCH_FAILED, err.message); }
  }

  // ── Optimus-first helpers ──
  async function tryOptimusInbox(tabId, previousFailed, failureContext) {
    const inboxSelector = '[class*="msg-overlay-list-bubble"], [class*="msg-conversations-container"], main, [role="main"]';
    const snap = await Optimus.snapshotPage(tabId, inboxSelector, 6, 3000);
    if (!snap || !snap.ok) return { success: false, error: snap && snap.error || "snapshot_failed", optimusUnavailable: false };

    const req = OptimusClient.requestPlan("linkedin", "messaging", snap.snapshot, {
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
    if (!planRes || !planRes.success) return { success: false, error: planRes && planRes.error || "plan_failed", optimusUnavailable: true };

    const execRes = await Optimus.executePlanInTab(tabId, inboxSelector, planRes.plan || planRes);
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

  async function tryOptimusThread(tabId, previousFailed, failureContext) {
    const threadSelector = '[class*="msg-s-message-list"], [class*="msg-thread"], main, [role="main"]';
    const snap = await Optimus.snapshotPage(tabId, threadSelector, 6, 3000);
    if (!snap || !snap.ok) return { success: false, error: snap && snap.error || "snapshot_failed", optimusUnavailable: false };

    const req = OptimusClient.requestPlan("linkedin", "thread", snap.snapshot, {
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
    if (!planRes || !planRes.success) return { success: false, error: planRes && planRes.error || "plan_failed", optimusUnavailable: true };

    const execRes = await Optimus.executePlanInTab(tabId, threadSelector, planRes.plan || planRes);
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

  function mapOptimusInboxItems(items) {
    return items.map(function (it) {
      return {
        name: it.participant_name || it.thread_name || it.name || "",
        threadUrl: it.thread_url || it.url || "",
        unread: !!(it.unread_indicator && String(it.unread_indicator).trim()),
        lastMessage: it.last_message_preview || it.last_message || it.preview || "",
        lastActivity: it.last_activity_time || it.timestamp || "",
      };
    }).filter(function (t) { return !!t.name; });
  }

  function mapOptimusThreadMessages(items) {
    return items.map(function (it) {
      const sender = it.message_sender || it.sender || "";
      const s = String(sender).toLowerCase().trim();
      const direction = it.direction || ((s === "tu" || s === "you" || s === "me" || s === "io") ? "outbound" : "inbound");
      return {
        text: it.message_text || it.text || it.body || "",
        sender: sender,
        timestamp: it.message_time || it.timestamp || it.time || new Date().toISOString(),
        direction: direction,
      };
    }).filter(function (m) { return !!m.text; });
  }

  async function readInbox() {
    // Force navigation to inbox list (not a specific thread)
    const tab = await TabManager.getLinkedInTab("https://www.linkedin.com/messaging/");
    await TabManager.ensureTabVisibleAndWait(tab.id, 1200);
    await TabManager.sleep(2500);

    // ── Optimus-first ──
    let optimus = await tryOptimusInbox(tab.id, false, null);
    if (optimus.success && optimus.items.length === 0 && optimus.cached) {
      optimus = await tryOptimusInbox(tab.id, true, "Cached plan returned 0 threads from LI messaging inbox");
    }

    if (optimus.success) {
      const threads = mapOptimusInboxItems(optimus.items);
      return {
        success: true,
        threads: threads,
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

    // Any Optimus failure → fall through to legacy AX/structural
    // (previously only fell through if optimusUnavailable was true,
    //  which missed cases where Optimus responded but plan execution failed)
    console.warn("[LI Actions] Optimus inbox failed, falling through to legacy:", optimus.error);

    // ── Legacy fallback ──
    // Legacy A: AX Tree
    let axError = null;
    try {
      const axResult = await AXTree.readInbox(tab.id);
      if (axResult && axResult.threads && axResult.threads.length > 0) {
        axResult.method = "legacy-ax";
        return axResult;
      }
      axError = "ax_tree returned 0 threads";
    } catch (e) { axError = e.message || String(e); }

    // Legacy B: structural fallback (kept here, used only when Optimus is down)
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          const threads = [];
          const seen = {};
          const modernCards = document.querySelectorAll('[class*="msg-conversation-card"], [class*="msg-convo-wrapper"], [data-control-name*="conversation"]');
          modernCards.forEach(function (card) {
            const link = card.querySelector("a[href*='/messaging/']") || card.closest("a[href*='/messaging/']");
            const threadUrl = link ? (link.href || "") : "";
            if (seen[threadUrl] && threadUrl) return;
            if (threadUrl) seen[threadUrl] = true;
            let name = "";
            const h3 = card.querySelector("h3");
            if (h3) name = h3.textContent.replace(/\s+/g, " ").trim();
            if (!name) { const spans = card.querySelectorAll("span"); for (let s = 0; s < Math.min(spans.length, 10); s++) { const t = (spans[s].textContent || "").trim(); if (t.length > 1 && t.length < 60 && !/^\d{1,2}[\/:\.]/.test(t)) { name = t; break; } } }
            if (!name || name.length < 2) return;
            let lastMsg = "";
            const msgEl = card.querySelector("p, [class*='snippet'], [class*='preview']");
            if (msgEl) lastMsg = msgEl.textContent.replace(/\s+/g, " ").trim().substring(0, 120);
            const unread = !!card.querySelector("[class*='unread'], [class*='badge'], [class*='dot']");
            threads.push({ name: name, threadUrl: threadUrl, unread: unread, lastMessage: lastMsg });
          });
          if (threads.length === 0) {
            const threadLinks = document.querySelectorAll("a[href*='/messaging/thread/']");
            threadLinks.forEach(function (link) {
              const threadUrl = link.href || "";
              if (seen[threadUrl]) return;
              seen[threadUrl] = true;
              const container = link.closest("li") || link.parentElement;
              if (!container) return;
              let name = "";
              const h3 = container.querySelector("h3");
              if (h3) { const h3t = h3.textContent.replace(/\s+/g, " ").trim(); if (h3t.length > 1 && h3t.length < 80) name = h3t; }
              if (!name) { const img = container.querySelector("img[alt]"); if (img) { const alt = (img.getAttribute("alt") || "").trim(); if (alt.length > 1 && alt.length < 60 && !/photo|foto|avatar/i.test(alt)) name = alt; } }
              if (!name) return;
              const msgP = container.querySelector("p, [class*='snippet']");
              const lastMsg = msgP ? msgP.textContent.replace(/\s+/g, " ").trim().substring(0, 120) : "";
              threads.push({ name: name, threadUrl: threadUrl, unread: false, lastMessage: lastMsg });
            });
          }
          return { success: true, threads: threads, method: "legacy-structural" };
        },
      });
      const out = (results[0] && results[0].result) || Config.errorResponse(Config.ERROR.INBOX_FAILED, "No inbox data");
      if (out && out.success) out.legacyReason = "optimus_unavailable: " + (optimus.error || "unknown");
      return out;
    } catch (e) {
      return Config.errorResponse(Config.ERROR.INBOX_FAILED, e.message + (axError ? " | AX: " + axError : ""));
    }
  }

  async function readThread(threadUrl) {
    if (!threadUrl) return Config.errorResponse(Config.ERROR.INBOX_FAILED, "Thread URL mancante");
    const tab = await TabManager.getLinkedInTab(threadUrl, false);
    await TabManager.ensureTabVisibleAndWait(tab.id, 1200);
    await TabManager.sleep(2500);

    // ── Optimus-first ──
    let optimus = await tryOptimusThread(tab.id, false, null);
    if (optimus.success && optimus.items.length === 0 && optimus.cached) {
      optimus = await tryOptimusThread(tab.id, true, "Cached plan returned 0 messages from LI thread " + threadUrl);
    }

    if (optimus.success) {
      const messages = mapOptimusThreadMessages(optimus.items);
      return {
        success: true,
        messages: messages,
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

    // Any Optimus failure → fall through to legacy AX/structural
    console.warn("[LI Actions] Optimus thread failed, falling through to legacy:", optimus.error);

    // ── Legacy fallback ──
    try {
      const axResult = await AXTree.readThread(tab.id);
      if (axResult && axResult.messages && axResult.messages.length > 0) {
        axResult.method = "legacy-ax";
        return axResult;
      }
    } catch (_) {}

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          const messages = [];
          let items = document.querySelectorAll("li[class*='msg-'], li[class*='message'], [class*='msg-s-event']");
          if (items.length === 0) items = document.querySelectorAll("main li, [role='main'] li");
          items.forEach(function (item) {
            const bodyEl = item.querySelector("p, [class*='body'], [class*='content']");
            const senderEl = item.querySelector("h3, span[class*='name'], [class*='sender']");
            const timeEl = item.querySelector("time, [class*='time']");
            const text = bodyEl ? bodyEl.textContent.trim() : "";
            const sender = senderEl ? senderEl.textContent.trim() : "";
            const timestamp = timeEl ? (timeEl.getAttribute("datetime") || timeEl.textContent.trim()) : new Date().toISOString();
            if (text) messages.push({ text: text, sender: sender, timestamp: timestamp, direction: "inbound" });
          });
          return { success: true, messages: messages, method: "legacy-structural" };
        },
      });
      return (results[0] && results[0].result) || Config.errorResponse(Config.ERROR.INBOX_FAILED, "No thread data");
    } catch (e) { return Config.errorResponse(Config.ERROR.INBOX_FAILED, e.message); }
  }

  async function diagnostic() {
    const tab = await TabManager.getLinkedInTab("https://www.linkedin.com/messaging/", false);
    await TabManager.ensureTabVisibleAndWait(tab.id, 1200);
    await TabManager.sleep(2500);

    let axAvailable = false;
    try { axAvailable = await AXTree.isAvailable(tab.id); } catch (_) {}

    const schema = await AILearn.getCached("messaging");

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () {
        const url = window.location.href;
        const title = document.title;
        const bodyLen = (document.body.innerText || "").length;
        const hasMain = !!document.querySelector("main, [role='main']");
        const hasNav = !!document.querySelector("nav, [role='banner'], [role='navigation']");
        const hasTextbox = !!document.querySelector("[role='textbox'], [contenteditable='true']");
        const threadLinks = document.querySelectorAll("a[href*='/messaging/thread/']").length;
        const buttons = [];
        document.querySelectorAll("button").forEach(function (b) {
          if (b.offsetParent !== null) buttons.push(b.textContent.trim().substring(0, 40));
        });
        const roles = [];
        document.querySelectorAll("[role]").forEach(function (el) {
          const r = el.getAttribute("role");
          if (roles.indexOf(r) === -1) roles.push(r);
        });
        return {
          success: true, url: url, title: title, bodyLength: bodyLen,
          hasMain: hasMain, hasNav: hasNav, hasTextbox: hasTextbox,
          threadLinksCount: threadLinks, visibleButtons: buttons.slice(0, 20), uniqueRoles: roles,
        };
      },
    });

    const domResult = (results[0] && results[0].result) || {};
    domResult.axTreeAvailable = axAvailable;
    domResult.aiLearnCached = !!schema;
    domResult.aiLearnAge = schema && schema.learnedAt ? Math.round((Date.now() - schema.learnedAt) / 60000) + " min ago" : "never";
    return domResult;
  }

  async function learnDom(pageType) {
    if (!Config.isReady()) return Config.errorResponse(Config.ERROR.NO_CONFIG, "Configurazione AI mancante");
    const url = pageType === "messaging" ? "https://www.linkedin.com/messaging/" : "https://www.linkedin.com/in/me/";
    const tab = await TabManager.getLinkedInTab(url, false);
    await TabManager.ensureTabVisibleAndWait(tab.id, 1200);
    await TabManager.sleep(2500);
    const schema = await AILearn.learnFromAI(tab.id, pageType || "profile", Config.getUrl(), Config.getKey());
    if (schema) return Config.successResponse({ schema: schema, keysCount: Object.keys(schema).length });
    return Config.errorResponse(Config.ERROR.AI_LEARN_FAILED, "AI learning failed");
  }

  return {
    extractProfileByUrl: extractProfileByUrl,
    sendLinkedInMessage: sendLinkedInMessage,
    sendConnectionRequest: sendConnectionRequest,
    searchProfile: searchProfile,
    readInbox: readInbox,
    readThread: readThread,
    diagnostic: diagnostic,
    learnDom: learnDom,
  };
})();
globalThis.Actions = Actions;
