// ══════════════════════════════════════════════
// WhatsApp Extension - Background Service Worker v3
// AI-Powered: sends raw HTML to edge function for intelligent extraction
// Falls back to DOM selectors if AI is unavailable
// ══════════════════════════════════════════════

const WA_BASE = "https://web.whatsapp.com";

const APP_URL_PATTERNS = [
  /^https:\/\/[^/]*\.lovable\.app\//i,
  /^https:\/\/[^/]*\.lovableproject\.com\//i,
  /^https?:\/\/localhost(?::\d+)?\//i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?\//i,
];

function isAppUrl(url) {
  return typeof url === "string" && APP_URL_PATTERNS.some((p) => p.test(url));
}

async function injectBridgeIntoFrame(tabId, frameId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files: ["content.js"],
    });
    return true;
  } catch (error) {
    var msg = error?.message || "";
    if (msg.includes("Cannot access") || msg.includes("Missing host") || msg.includes("No frame") || msg.includes("Frame with ID") || msg.includes("gallery")) return false;
    console.warn("[WA] Bridge inject failed:", msg);
    return false;
  }
}

async function injectBridgeIntoTab(tabId) {
  try {
    var frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (!frames?.length) return false;
    var injected = false;
    for (var f of frames) {
      if (!isAppUrl(f.url)) continue;
      var ok = await injectBridgeIntoFrame(tabId, f.frameId);
      injected = ok || injected;
    }
    return injected;
  } catch (e) {
    return false;
  }
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function safeCreateTab(url, active) {
  for (var i = 0; i < 3; i++) {
    try { return await chrome.tabs.create({ url, active: active || false }); }
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

// ── Persistent WA tab ──
async function getOrCreateWaTab() {
  try {
    var tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    if (tabs.length > 0) {
      var tab = tabs[0];
      if (tab.status === "complete") return { tab: tab, reused: true };
      await waitForLoad(tab.id, 15000);
      return { tab: tab, reused: true };
    }
  } catch (_) {}
  var tab = await safeCreateTab(WA_BASE, false);
  var loaded = await waitForLoad(tab.id, 30000);
  if (!loaded) throw new Error("WhatsApp Web non caricato");
  await sleep(4000);
  return { tab: tab, reused: false };
}

// ── Grab sidebar/chat HTML from WA tab ──
async function grabHtml(tabId, selector) {
  var results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    args: [selector],
    func: function(sel) {
      var el = document.querySelector(sel);
      return el ? el.outerHTML : null;
    },
  });
  return results?.[0]?.result || null;
}

// ── Call AI edge function ──
async function callAiExtract(html, mode, supabaseUrl, anonKey, authToken) {
  try {
    var url = supabaseUrl + "/functions/v1/whatsapp-ai-extract";
    var headers = {
      "Content-Type": "application/json",
      "apikey": anonKey,
    };
    if (authToken) headers["Authorization"] = "Bearer " + authToken;
    else headers["Authorization"] = "Bearer " + anonKey;

    var resp = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ html: html, mode: mode }),
    });

    if (!resp.ok) {
      console.warn("[WA AI] Edge function error:", resp.status);
      return null;
    }

    var data = await resp.json();
    return data;
  } catch (e) {
    console.warn("[WA AI] Fetch failed:", e.message);
    return null;
  }
}

// ── Get stored config (supabase URL + keys) ──
async function getConfig() {
  try {
    var data = await chrome.storage.local.get(["supabaseUrl", "anonKey", "authToken"]);
    return data;
  } catch (_) {
    return {};
  }
}

// ── DOM-based fallback: read sidebar chats ──
// Always extracts the last VERIFY_COUNT chats (unread or not) for rolling verification
async function readUnreadDOM(tabId) {
  var results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function() {
      var VERIFY_COUNT = 5;
      var qr = document.querySelector('canvas[aria-label], [data-testid="qrcode"]');
      if (qr) return { success: false, error: "QR code visibile - accedi a WhatsApp Web" };
      var messages = [];
      var chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
      if (!chatItems.length) chatItems = document.querySelectorAll('#pane-side [role="listitem"]');
      if (!chatItems.length) {
        var pane = document.querySelector("#pane-side") || document.querySelector('[data-testid="chatlist"]');
        if (pane) chatItems = pane.querySelectorAll('[tabindex="-1"]');
      }
      var processed = 0;
      for (var chat of chatItems) {
        // Check unread badge
        var badge = chat.querySelector('[data-testid="icon-unread-count"]') ||
          chat.querySelector('span[aria-label*="non lett"]') ||
          chat.querySelector('span[aria-label*="unread"]');
        var count = 0;
        if (badge) { count = parseInt(badge.textContent) || 1; }
        else {
          var spans = chat.querySelectorAll('span');
          for (var s of spans) {
            var bg = window.getComputedStyle(s).backgroundColor;
            var txt = s.textContent.trim();
            if (txt && /^\d+$/.test(txt) && bg && (bg.includes("37, 211") || bg.includes("25d366") || bg.includes("00a884"))) {
              count = parseInt(txt) || 1; break;
            }
          }
        }
        // Always extract the first VERIFY_COUNT chats for rolling verification
        var isVerify = processed < VERIFY_COUNT;
        if (count === 0 && !isVerify) continue;

        var titleEl = chat.querySelector('[data-testid="cell-frame-title"] span[title]') ||
          chat.querySelector('span[title][dir="auto"]') || chat.querySelector('span[title]');
        var lastMsgEl = chat.querySelector('[data-testid="last-msg-status"]') ||
          chat.querySelector('[data-testid="cell-frame-secondary"] span[title]') ||
          chat.querySelector('[data-testid="cell-frame-secondary"] span');
        var timeEl = chat.querySelector('[data-testid="cell-frame-primary-detail"]');
        messages.push({
          contact: titleEl?.getAttribute("title") || titleEl?.textContent?.trim() || "Sconosciuto",
          lastMessage: lastMsgEl?.textContent?.trim() || "",
          time: timeEl?.textContent?.trim() || new Date().toISOString(),
          unreadCount: count,
          isVerify: isVerify && count === 0,
        });
        processed++;
      }
      return { success: true, messages: messages, scanned: chatItems.length };
    },
  });
  return results?.[0]?.result || { success: false, error: "No result" };
}

// ── AI-powered readUnread ──
async function readUnreadMessages() {
  try {
    var r = await getOrCreateWaTab();
    var tab = r.tab;
    await sleep(r.reused ? 1500 : 5000);

    // First check if logged in
    var loginCheck = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() {
        return !!document.querySelector('canvas[aria-label], [data-testid="qrcode"]');
      }
    });
    if (loginCheck?.[0]?.result) {
      return { success: false, error: "WhatsApp Web non connesso - scansiona il QR code" };
    }

    // Try AI extraction first
    var config = await getConfig();
    if (config.supabaseUrl && config.anonKey) {
      var sidebarHtml = await grabHtml(tab.id, "#pane-side");
      if (sidebarHtml && sidebarHtml.length > 100) {
        console.log("[WA] Sending " + sidebarHtml.length + " chars to AI for extraction");
        var aiResult = await callAiExtract(sidebarHtml, "sidebar", config.supabaseUrl, config.anonKey, config.authToken);
        if (aiResult && aiResult.success && aiResult.items && aiResult.items.length > 0) {
          console.log("[WA] AI extracted " + aiResult.items.length + " unread chats");
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
          };
        }
        console.log("[WA] AI returned 0 items, falling back to DOM");
      }
    }

    // Fallback to DOM selectors
    console.log("[WA] Using DOM fallback for readUnread");
    var domResult = await readUnreadDOM(tab.id);
    if (domResult) domResult.method = "dom";
    return domResult;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Send a WhatsApp message ──
async function sendWhatsAppMessage(phone, text) {
  var cleanPhone = phone.replace(/[^0-9]/g, "");
  var url = WA_BASE + "/send?phone=" + cleanPhone + "&text=" + encodeURIComponent(text);
  var tab;
  try {
    tab = await safeCreateTab(url, false);
    var loaded = await waitForLoad(tab.id, 30000);
    if (!loaded) { await safeRemoveTab(tab.id); return { success: false, error: "WA non caricato" }; }
    await sleep(3000);
    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async function() {
        var start = Date.now();
        while (Date.now() - start < 15000) {
          var qr = document.querySelector('canvas[aria-label], [data-testid="qrcode"]');
          if (qr) return { success: false, error: "Non connesso a WhatsApp Web" };
          var btn = document.querySelector('span[data-icon="send"]') ||
            document.querySelector('button[aria-label="Invia"]') ||
            document.querySelector('button[aria-label="Send"]') ||
            document.querySelector('[data-testid="send"]');
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
    var result = results?.[0]?.result;
    await sleep(500);
    await safeRemoveTab(tab.id);
    return result || { success: false, error: "Nessun risultato" };
  } catch (err) {
    if (tab?.id) await safeRemoveTab(tab.id);
    return { success: false, error: err.message };
  }
}

// ── Verify session ──
async function verifySession() {
  try {
    // First try to find an existing WA tab without creating one
    var tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    var tabId;
    if (tabs.length > 0) {
      tabId = tabs[0].id;
      // If tab exists but not loaded, wait briefly
      if (tabs[0].status !== "complete") await waitForLoad(tabId, 8000);
    } else {
      // No WA tab - create one
      var r = await getOrCreateWaTab();
      tabId = r.tab.id;
      await sleep(3000);
    }
    
    // Try up to 3 times with short delays (WA Web can be slow to render DOM)
    for (var attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(2000);
      try {
        var results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: function() {
            if (document.querySelector('canvas[aria-label], [data-testid="qrcode"]'))
              return { success: true, authenticated: false, reason: "qr_required" };
            if (document.querySelector("#side") || document.querySelector('[data-testid="chatlist"]') || document.querySelector("#pane-side"))
              return { success: true, authenticated: true };
            // Check if page is still loading
            if (document.querySelector('[data-testid="intro-md-beta-logo"]') || document.querySelector('.landing-window'))
              return { success: true, authenticated: false, reason: "loading" };
            return null; // retry
          },
        });
        var result = results?.[0]?.result;
        if (result) return result;
      } catch (_) {}
    }
    return { success: true, authenticated: false, reason: "unknown_state" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Read thread (AI-powered) ──
async function readChatThread(contactName, maxMessages) {
  try {
    var r = await getOrCreateWaTab();
    await sleep(r.reused ? 1500 : 5000);
    var results = await chrome.scripting.executeScript({
      target: { tabId: r.tab.id },
      args: [contactName],
      func: async function(target) {
        var searchBox = document.querySelector('[data-testid="chat-list-search"] [contenteditable="true"]') ||
          document.querySelector('#side [contenteditable="true"]');
        if (!searchBox) return { success: false, error: "Search box not found" };
        searchBox.focus();
        searchBox.textContent = "";
        document.execCommand("insertText", false, target);
        await new Promise(function(r) { setTimeout(r, 1500); });
        var chats = document.querySelectorAll('[data-testid="cell-frame-container"], #pane-side [role="listitem"]');
        var clicked = false;
        for (var c of chats) {
          var t = c.querySelector('span[title]');
          if (t && t.getAttribute("title").toLowerCase().includes(target.toLowerCase())) { c.click(); clicked = true; break; }
        }
        if (!clicked) return { success: false, error: "Chat non trovata: " + target };
        await new Promise(function(r) { setTimeout(r, 2000); });
        // Get the conversation panel HTML for AI extraction
        var panel = document.querySelector('[data-testid="conversation-panel-messages"]') ||
          document.querySelector("#main [role='application']") ||
          document.querySelector("#main");
        var html = panel ? panel.outerHTML : null;
        // Clear search
        var clearBtn = document.querySelector('[data-testid="search-input-clear"]') ||
          document.querySelector('[data-testid="x-alt"]');
        if (clearBtn) clearBtn.click();
        return { success: true, html: html };
      },
    });

    var scriptResult = results?.[0]?.result;
    if (!scriptResult?.success) return scriptResult || { success: false, error: "Script error" };

    // Try AI extraction for thread
    if (scriptResult.html) {
      var config = await getConfig();
      if (config.supabaseUrl && config.anonKey) {
        var aiResult = await callAiExtract(scriptResult.html, "thread", config.supabaseUrl, config.anonKey, config.authToken);
        if (aiResult && aiResult.success && aiResult.items && aiResult.items.length > 0) {
          return {
            success: true,
            messages: aiResult.items.map(function(m) {
              return {
                direction: m.direction || "inbound",
                text: m.text || "",
                timestamp: m.timestamp || "",
                contact: m.contact || contactName,
              };
            }),
            contact: contactName,
            method: "ai",
          };
        }
      }
    }

    // Fallback: basic DOM extraction
    var domResults = await chrome.scripting.executeScript({
      target: { tabId: r.tab.id },
      args: [contactName, maxMessages || 50],
      func: function(target, limit) {
        var msgEls = document.querySelectorAll('[data-testid="msg-container"]');
        var msgs = [];
        var items = Array.from(msgEls).slice(-limit);
        for (var el of items) {
          var isOut = el.querySelector('[data-testid="msg-dblcheck"]') !== null || el.querySelector('[data-testid="msg-check"]') !== null;
          var textEl = el.querySelector('[data-testid="balloon-text"] span, .selectable-text span');
          var text = textEl?.textContent?.trim() || "";
          if (!text) continue;
          var timeEl = el.querySelector('[data-testid="msg-meta"] span');
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

// ── Lifecycle: re-inject bridge after install/update/startup ──
chrome.runtime.onInstalled.addListener(function() { syncBridgeAcrossOpenTabs().catch(function(){}); });
chrome.runtime.onStartup.addListener(function() { syncBridgeAcrossOpenTabs().catch(function(){}); });

// Re-inject bridge when app tabs finish loading (handles extension reload)
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === "complete" && tab.url && isAppUrl(tab.url)) {
    injectBridgeIntoTab(tabId).catch(function(){});
  }
});

// ── Message handler ──
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.source !== "wa-content-bridge") return false;

  if (msg.action === "ping") {
    sendResponse({ success: true, version: "3.0-ai" });
    return false;
  }

  if (msg.action === "setConfig") {
    chrome.storage.local.set({
      supabaseUrl: msg.supabaseUrl || "",
      anonKey: msg.anonKey || "",
      authToken: msg.authToken || "",
    }).then(function() {
      sendResponse({ success: true });
    });
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

  if (msg.action === "diagnosticDom") {
    (async function() {
      try {
        var r = await getOrCreateWaTab();
        await sleep(r.reused ? 1000 : 4000);
        var results = await chrome.scripting.executeScript({
          target: { tabId: r.tab.id },
          func: function() {
            var diag = {};
            diag.url = location.href;
            diag.title = document.title;
            diag.hasQR = !!document.querySelector('canvas[aria-label], [data-testid="qrcode"]');
            diag.hasSide = !!document.querySelector("#side");
            diag.hasPaneSide = !!document.querySelector("#pane-side");
            diag.hasChatlist = !!document.querySelector('[data-testid="chatlist"]');
            diag.cellFrames = document.querySelectorAll('[data-testid="cell-frame-container"]').length;
            diag.listItems = document.querySelectorAll('#pane-side [role="listitem"]').length;
            diag.tabIndexItems = 0;
            var pane = document.querySelector("#pane-side") || document.querySelector('[data-testid="chatlist"]');
            if (pane) diag.tabIndexItems = pane.querySelectorAll('[tabindex="-1"]').length;
            diag.unreadBadges = document.querySelectorAll('[data-testid="icon-unread-count"]').length;
            // Sample first chat structure
            var first = document.querySelector('[data-testid="cell-frame-container"]') || (pane && pane.querySelector('[tabindex="-1"]'));
            if (first) {
              diag.firstChatHTML = first.outerHTML.slice(0, 1000);
              var titleEl = first.querySelector('span[title]');
              diag.firstTitle = titleEl ? titleEl.getAttribute("title") : null;
            }
            diag.bodyChildCount = document.body.children.length;
            diag.appDiv = !!document.querySelector("#app");
            return { success: true, diagnostic: diag };
          }
        });
        sendResponse(results?.[0]?.result || { success: false, error: "no result" });
      } catch(e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === "readThread") {
    if (!msg.contact) { sendResponse({ success: false, error: "contact richiesto" }); return false; }
    readChatThread(msg.contact, msg.maxMessages || 50).then(sendResponse);
    return true;
  }

  sendResponse({ success: false, error: "Azione sconosciuta: " + msg.action });
  return false;
});
