// ══════════════════════════════════════════════════
// LinkedIn Extension — High-Level Actions Module
// Orchestrates hybrid operations into user-facing actions
// ══════════════════════════════════════════════════

var Actions = (function () {

  async function extractProfileByUrl(url) {
    if (!url) return Config.errorResponse(Config.ERROR.EXTRACTION_FAILED, "URL mancante");
    var tab = await TabManager.getLinkedInTab(url);
    return await HybridOps.extractProfile(tab.id);
  }

  async function sendLinkedInMessage(profileUrl, message) {
    if (!profileUrl) return Config.errorResponse(Config.ERROR.MESSAGE_FAILED, "URL profilo mancante");
    if (!message) return Config.errorResponse(Config.ERROR.MESSAGE_FAILED, "Messaggio mancante");
    var tab = await TabManager.getLinkedInTab(profileUrl.replace(/\/$/, ""));
    var clickResult = await HybridOps.clickMessage(tab.id);
    if (!clickResult || !clickResult.success) return Config.errorResponse(Config.ERROR.MESSAGE_FAILED, (clickResult && clickResult.error) || "Message button not found");
    await TabManager.sleep(3000);
    return await HybridOps.sendMessage(tab.id, message);
  }

  async function sendConnectionRequest(profileUrl, note) {
    if (!profileUrl) return Config.errorResponse(Config.ERROR.CONNECT_FAILED, "URL profilo mancante");
    var tab = await TabManager.getLinkedInTab(profileUrl.replace(/\/$/, ""));
    var clickResult = await HybridOps.clickConnect(tab.id);
    if (!clickResult || !clickResult.success) return Config.errorResponse(Config.ERROR.CONNECT_FAILED, (clickResult && clickResult.error) || "Connect button not found");
    await TabManager.sleep(2000);
    if (note && note.trim()) {
      return await HybridOps.addNote(tab.id, note);
    }
    // Send without note
    try {
      var sendRes = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          var btn = Array.from(document.querySelectorAll("button")).find(function (el) {
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
    var searchUrl = "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(query);
    var tab = await TabManager.getLinkedInTab(searchUrl);
    await TabManager.sleep(3000);
    try {
      var results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          var allLinks = document.querySelectorAll("a[href*='/in/']");
          for (var i = 0; i < allLinks.length; i++) {
            var href = allLinks[i].href || "";
            if (/linkedin\.com\/in\/[^/]+/.test(href) && !/\/in\/miniprofile/.test(href) && !/\/in\/ACo/.test(href)) {
              var cleanUrl = href.split("?")[0].replace(/\/$/, "");
              var container = allLinks[i].closest("li, [data-chameleon-result-urn]");
              var name = "";
              var headline = "";
              if (container) {
                var nameEl = container.querySelector("span[aria-hidden='true']");
                if (nameEl) name = nameEl.textContent.trim();
                if (!name) { var dirEl = container.querySelector("h3 span[dir='ltr'], a span[dir='ltr'], span[dir='ltr']"); if (dirEl) name = dirEl.textContent.trim(); }
                if (!name && allLinks[i].textContent) { var lt = allLinks[i].textContent.replace(/\s+/g, " ").trim(); if (lt.length > 1 && lt.length < 80) name = lt; }
                if (!name) { var h = container.querySelector("h3, h4"); if (h) name = h.textContent.replace(/\s+/g, " ").trim(); }
                var secEl = container.querySelector("div[class*='subtitle'], p[class*='summary']");
                if (secEl) headline = secEl.textContent.replace(/\s+/g, " ").trim().substring(0, 200);
                if (!headline) { var ps = container.querySelectorAll("p, div[class*='t-']"); for (var pp = 0; pp < ps.length; pp++) { var pt = ps[pp].textContent.replace(/\s+/g, " ").trim(); if (pt && pt !== name && pt.length > 3 && pt.length < 200) { headline = pt; break; } } }
              }
              if (!name) { var al = allLinks[i].getAttribute("aria-label") || ""; if (al.length > 1) name = al.split(",")[0].trim(); }
              return { profileUrl: cleanUrl, name: name, headline: headline };
            }
          }
          return null;
        },
      });
      var profileData = results[0] && results[0].result;
      if (profileData && profileData.profileUrl) return Config.successResponse({ profile: profileData });
      return Config.errorResponse(Config.ERROR.SEARCH_FAILED, "Nessun profilo trovato per: " + query);
    } catch (err) { return Config.errorResponse(Config.ERROR.SEARCH_FAILED, err.message); }
  }

  async function readInbox() {
    // Force navigation to inbox list (not a specific thread)
    var tab = await TabManager.getLinkedInTab("https://www.linkedin.com/messaging/");

    // Smart wait: up to 8s, checking for conversation elements every 500ms
    var waited = 0;
    var maxWait = 8000;
    while (waited < maxWait) {
      await TabManager.sleep(500);
      waited += 500;
      try {
        var readyCheck = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: function () {
            return document.querySelectorAll('a[href*="/messaging/thread/"], [class*="msg-conversation"], [class*="msg-convo"], li[class*="msg-"]').length;
          },
        });
        if (readyCheck[0] && readyCheck[0].result > 0) break;
      } catch (_) {}
    }

    // Level 1: AX Tree
    var axError = null;
    try {
      var axResult = await AXTree.readInbox(tab.id);
      if (axResult && axResult.threads && axResult.threads.length > 0) return axResult;
      axError = "ax_tree returned 0 threads";
    } catch (e) { axError = e.message || String(e); console.warn("[LI-Hybrid] AX inbox failed:", axError); }

    // Level 2: Structural fallback — multiple strategies
    try {
      var results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          var threads = [];
          var seen = {};
          var diagnostics = { methods: [], candidatesFound: 0, candidatesRejected: 0, url: window.location.href, bodyLength: (document.body.innerText || "").length };

          // Strategy 0: Modern selectors (2025-2026 LinkedIn layout)
          var modernCards = document.querySelectorAll('[class*="msg-conversation-card"], [class*="msg-convo-wrapper"], [data-control-name*="conversation"], [class*="msg-overlay-conversation-bubble"]');
          diagnostics.methods.push("modern_cards:" + modernCards.length);
          modernCards.forEach(function (card) {
            diagnostics.candidatesFound++;
            var link = card.querySelector("a[href*='/messaging/']") || card.closest("a[href*='/messaging/']");
            var threadUrl = link ? (link.href || "") : "";
            if (seen[threadUrl] && threadUrl) return;
            if (threadUrl) seen[threadUrl] = true;
            var name = "";
            var h3 = card.querySelector("h3");
            if (h3) name = h3.textContent.replace(/\s+/g, " ").trim();
            if (!name) { var spans = card.querySelectorAll("span"); for (var s = 0; s < Math.min(spans.length, 10); s++) { var t = (spans[s].textContent || "").trim(); if (t.length > 1 && t.length < 60 && !/^\d{1,2}[\/:\.]/.test(t) && !/^(oggi|ieri|today|yesterday|now|ora)/i.test(t)) { name = t; break; } } }
            if (!name || name.length < 2) { diagnostics.candidatesRejected++; return; }
            var lastMsg = "";
            var msgEl = card.querySelector("p, [class*='snippet'], [class*='preview']");
            if (msgEl) lastMsg = msgEl.textContent.replace(/\s+/g, " ").trim().substring(0, 120);
            var unread = !!card.querySelector("[class*='unread'], [class*='badge'], [class*='dot']");
            threads.push({ name: name, threadUrl: threadUrl, unread: unread, lastMessage: lastMsg });
          });

          // Strategy 1: thread links
          if (threads.length === 0) {
            var threadLinks = document.querySelectorAll("a[href*='/messaging/thread/']");
            diagnostics.methods.push("thread_links:" + threadLinks.length);
            threadLinks.forEach(function (link) {
              var threadUrl = link.href || "";
              if (seen[threadUrl]) return;
              seen[threadUrl] = true;
              var container = link.closest("li") || link.parentElement;
              if (!container) return;
              diagnostics.candidatesFound++;
              var name = "";
              var lastMsg = "";
              var unread = false;
              var h3 = container.querySelector("h3");
              if (h3) { var h3t = h3.textContent.replace(/\s+/g, " ").trim(); if (h3t.length > 1 && h3t.length < 80) name = h3t; }
              if (!name) { var spans = container.querySelectorAll("span"); for (var si = 0; si < spans.length; si++) { var st = (spans[si].textContent || "").trim(); if (st.length > 1 && st.length < 60 && !/^\d{1,2}[\/:\.]/.test(st) && !/^(oggi|ieri|today|yesterday|now|ora)/i.test(st) && !/^(passa|go to|details)/i.test(st)) { name = st; break; } } }
              if (!name) { var img = container.querySelector("img[alt]"); if (img) { var alt = (img.getAttribute("alt") || "").trim(); if (alt.length > 1 && alt.length < 60 && !/photo|foto|avatar/i.test(alt)) name = alt; } }
              var msgP = container.querySelector("p, [class*='snippet']");
              if (msgP) lastMsg = msgP.textContent.replace(/\s+/g, " ").trim().substring(0, 120);
              var badge = container.querySelector("[class*='unread'], [class*='badge']");
              if (badge) unread = true;
              if (!name || /^(passa ai|go to|details|dettagli|conversation|conversazione)/i.test(name)) { diagnostics.candidatesRejected++; return; }
              threads.push({ name: name, threadUrl: threadUrl, unread: unread, lastMessage: lastMsg });
            });
          }

          // Strategy 2: list items in messaging sidebar
          if (threads.length === 0) {
            var listItems = document.querySelectorAll("ul li, [role='list'] [role='listitem'], [class*='msg-conversation-listitem'], [class*='conversation-list'] li");
            diagnostics.methods.push("list_items:" + listItems.length);
            listItems.forEach(function (li) {
              diagnostics.candidatesFound++;
              var link = li.querySelector("a[href*='/messaging/'], a[href*='thread']");
              var threadUrl = link ? (link.href || "") : "";
              if (seen[threadUrl] && threadUrl) return;
              if (threadUrl) seen[threadUrl] = true;
              var name = "";
              var h3 = li.querySelector("h3");
              if (h3) name = h3.textContent.replace(/\s+/g, " ").trim();
              if (!name) { var img = li.querySelector("img[alt]"); if (img) { var alt = (img.getAttribute("alt") || "").trim(); if (alt.length > 1 && alt.length < 60 && !/photo|foto|avatar|placeholder/i.test(alt)) name = alt; } }
              if (!name) { var spans = li.querySelectorAll("span, p"); for (var s = 0; s < Math.min(spans.length, 10); s++) { var t = (spans[s].textContent || "").trim(); if (t.length > 1 && t.length < 60 && !/^\d/.test(t) && !/^(passa|go to|details|scrivi|messaggistica)/i.test(t)) { name = t; break; } } }
              if (!name || name.length < 2) { diagnostics.candidatesRejected++; return; }
              var lastMsg = "";
              var msgEl = li.querySelector("p, [class*='snippet'], [class*='preview']");
              if (msgEl) lastMsg = msgEl.textContent.replace(/\s+/g, " ").trim().substring(0, 120);
              var unread = !!li.querySelector("[class*='unread'], [class*='badge'], [class*='dot']");
              threads.push({ name: name, threadUrl: threadUrl, unread: unread, lastMessage: lastMsg });
            });
          }

          // Strategy 3: conversation cards by img alt text
          if (threads.length === 0) {
            var imgs = document.querySelectorAll("img[alt]");
            diagnostics.methods.push("img_alt:" + imgs.length);
            imgs.forEach(function (img) {
              var alt = (img.getAttribute("alt") || "").trim();
              if (alt.length < 2 || alt.length > 60) return;
              if (/photo|foto|avatar|placeholder|logo|linkedin/i.test(alt)) return;
              var container = img.closest("li, a, [role='listitem']");
              if (!container) return;
              diagnostics.candidatesFound++;
              if (seen[alt]) return;
              seen[alt] = true;
              var link = container.querySelector("a[href*='/messaging/']") || (container.tagName === "A" ? container : null);
              var threadUrl = link ? (link.href || "") : "";
              threads.push({ name: alt, threadUrl: threadUrl, unread: false, lastMessage: "" });
            });
          }

          // Strategy 4: Generic anchor scan for messaging links with text
          if (threads.length === 0) {
            var allAnchors = document.querySelectorAll("a[href*='/messaging/']");
            diagnostics.methods.push("generic_anchors:" + allAnchors.length);
            allAnchors.forEach(function (a) {
              var href = a.href || "";
              if (!/\/messaging\/thread\//.test(href)) return;
              if (seen[href]) return;
              seen[href] = true;
              diagnostics.candidatesFound++;
              var text = a.textContent.replace(/\s+/g, " ").trim();
              // Extract first plausible name from text
              var parts = text.split(/\n/).map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 1 && p.length < 60; });
              var name = "";
              for (var p = 0; p < parts.length; p++) {
                if (!/^\d/.test(parts[p]) && !/^(passa|go to|details|scrivi|messaggistica|today|yesterday|oggi|ieri)/i.test(parts[p])) { name = parts[p]; break; }
              }
              if (name) threads.push({ name: name, threadUrl: href, unread: false, lastMessage: "" });
            });
          }

          // Enhanced diagnostics if 0 threads
          if (threads.length === 0) {
            diagnostics.aCount = document.querySelectorAll("a").length;
            diagnostics.liCount = document.querySelectorAll("li").length;
            diagnostics.h3Count = document.querySelectorAll("h3").length;
            diagnostics.imgCount = document.querySelectorAll("img").length;
            diagnostics.bodyTextPreview = (document.body.innerText || "").substring(0, 500);
          }

          return { success: true, threads: threads, method: "structural_fallback", diagnostics: diagnostics };
        },
      });
      return (results[0] && results[0].result) || Config.errorResponse(Config.ERROR.INBOX_FAILED, "No inbox data");
    } catch (e) { return Config.errorResponse(Config.ERROR.INBOX_FAILED, e.message + (axError ? " | AX: " + axError : "")); }
  }

  async function readThread(threadUrl) {
    if (!threadUrl) return Config.errorResponse(Config.ERROR.INBOX_FAILED, "Thread URL mancante");
    var tab = await TabManager.getLinkedInTab(threadUrl, false);
    await TabManager.sleep(6000);

    // Level 1: AX Tree
    try {
      var axResult = await AXTree.readThread(tab.id);
      if (axResult && axResult.messages && axResult.messages.length > 0) return axResult;
    } catch (_) {}

    // Level 3: Structural fallback
    try {
      var results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          var messages = [];
          var items = document.querySelectorAll("li[class*='msg-'], li[class*='message'], [class*='msg-s-event']");
          if (items.length === 0) items = document.querySelectorAll("main li, [role='main'] li");
          items.forEach(function (item) {
            var bodyEl = item.querySelector("p, [class*='body'], [class*='content']");
            var senderEl = item.querySelector("h3, span[class*='name'], [class*='sender']");
            var timeEl = item.querySelector("time, [class*='time']");
            var text = bodyEl ? bodyEl.textContent.trim() : "";
            var sender = senderEl ? senderEl.textContent.trim() : "";
            var timestamp = timeEl ? (timeEl.getAttribute("datetime") || timeEl.textContent.trim()) : new Date().toISOString();
            if (text) messages.push({ text: text, sender: sender, timestamp: timestamp, direction: "inbound" });
          });
          return { success: true, messages: messages, method: "structural_fallback" };
        },
      });
      return (results[0] && results[0].result) || Config.errorResponse(Config.ERROR.INBOX_FAILED, "No thread data");
    } catch (e) { return Config.errorResponse(Config.ERROR.INBOX_FAILED, e.message); }
  }

  async function diagnostic() {
    var tab = await TabManager.getLinkedInTab("https://www.linkedin.com/messaging/", false);
    await TabManager.sleep(5000);

    var axAvailable = false;
    try { axAvailable = await AXTree.isAvailable(tab.id); } catch (_) {}

    var schema = await AILearn.getCached();

    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () {
        var url = window.location.href;
        var title = document.title;
        var bodyLen = (document.body.innerText || "").length;
        var hasMain = !!document.querySelector("main, [role='main']");
        var hasNav = !!document.querySelector("nav, [role='banner'], [role='navigation']");
        var hasTextbox = !!document.querySelector("[role='textbox'], [contenteditable='true']");
        var threadLinks = document.querySelectorAll("a[href*='/messaging/thread/']").length;
        var buttons = [];
        document.querySelectorAll("button").forEach(function (b) {
          if (b.offsetParent !== null) buttons.push(b.textContent.trim().substring(0, 40));
        });
        var roles = [];
        document.querySelectorAll("[role]").forEach(function (el) {
          var r = el.getAttribute("role");
          if (roles.indexOf(r) === -1) roles.push(r);
        });
        return {
          success: true, url: url, title: title, bodyLength: bodyLen,
          hasMain: hasMain, hasNav: hasNav, hasTextbox: hasTextbox,
          threadLinksCount: threadLinks, visibleButtons: buttons.slice(0, 20), uniqueRoles: roles,
        };
      },
    });

    var domResult = (results[0] && results[0].result) || {};
    domResult.axTreeAvailable = axAvailable;
    domResult.aiLearnCached = !!schema;
    domResult.aiLearnAge = schema && schema.learnedAt ? Math.round((Date.now() - schema.learnedAt) / 60000) + " min ago" : "never";
    return domResult;
  }

  async function learnDom(pageType) {
    if (!Config.isReady()) return Config.errorResponse(Config.ERROR.NO_CONFIG, "Configurazione AI mancante");
    var url = pageType === "messaging" ? "https://www.linkedin.com/messaging/" : "https://www.linkedin.com/in/me/";
    var tab = await TabManager.getLinkedInTab(url, false);
    await TabManager.sleep(4000);
    var schema = await AILearn.learnFromAI(tab.id, pageType || "profile", Config.getUrl(), Config.getKey());
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
