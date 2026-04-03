// ══════════════════════════════════════════════
// WhatsApp Extension - Background Service Worker v2
// Automates sending + reading messages via web.whatsapp.com
// Robust DOM selectors with multiple fallbacks
// ══════════════════════════════════════════════

const WA_BASE = "https://web.whatsapp.com";

const APP_URL_PATTERNS = [
  /^https:\/\/[^/]*\.lovable\.app\//i,
  /^https:\/\/[^/]*\.lovableproject\.com\//i,
  /^https?:\/\/localhost(?::\d+)?\//i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?\//i,
];

function isAppUrl(url) {
  return typeof url === "string" && APP_URL_PATTERNS.some((pattern) => pattern.test(url));
}

async function injectBridgeIntoFrame(tabId, frameId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files: ["content.js"],
    });
    return true;
  } catch (error) {
    const message = error?.message || "";
    if (
      message.includes("Cannot access") ||
      message.includes("Missing host permission") ||
      message.includes("No frame with id") ||
      message.includes("Frame with ID") ||
      message.includes("The extensions gallery cannot be scripted")
    ) {
      return false;
    }
    console.warn("[WA Extension] Bridge injection failed:", message);
    return false;
  }
}

async function injectBridgeIntoTab(tabId) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (!frames?.length) return false;

    let injected = false;
    for (const frame of frames) {
      if (!isAppUrl(frame.url)) continue;
      const ok = await injectBridgeIntoFrame(tabId, frame.frameId);
      injected = ok || injected;
    }
    return injected;
  } catch (error) {
    const message = error?.message || "";
    if (message) {
      console.warn("[WA Extension] Unable to inspect tab frames:", message);
    }
    return false;
  }
}

async function syncBridgeAcrossOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (typeof tab.id !== "number") continue;
      await injectBridgeIntoTab(tab.id);
    }
  } catch (error) {
    console.warn("[WA Extension] Failed to sync bridge on open tabs:", error?.message || error);
  }
}


function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeCreateTab(url, active = false, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await chrome.tabs.create({ url, active });
    } catch (e) {
      if (i < retries - 1) await sleep(500 * (i + 1));
      else throw e;
    }
  }
}

async function safeRemoveTab(tabId) {
  try { await chrome.tabs.remove(tabId); } catch (_) {}
}

async function waitForLoad(tabId, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") return true;
    } catch (_) { return false; }
    await sleep(500);
  }
  return false;
}

// ── Find existing WhatsApp Web tab or create one ──
// The tab is NEVER closed — it stays open for fast re-use.

async function getOrCreateWaTab() {
  // Look for an already-open WA tab
  try {
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    if (tabs.length > 0) {
      const tab = tabs[0];
      if (tab.status === "complete") return { tab, reused: true };
      await waitForLoad(tab.id, 15000);
      return { tab, reused: true };
    }
  } catch (_) {}

  // No existing tab — create one (it will stay open permanently)
  const tab = await safeCreateTab(WA_BASE, false);
  const loaded = await waitForLoad(tab.id, 30000);
  if (!loaded) {
    throw new Error("WhatsApp Web non ha caricato in tempo");
  }
  await sleep(4000);
  return { tab, reused: false };
}

// ── Send a WhatsApp message ──

async function sendWhatsAppMessage(phone, text) {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const url = `${WA_BASE}/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;

  let tab;
  try {
    tab = await safeCreateTab(url, false);
    const loaded = await waitForLoad(tab.id, 30000);
    if (!loaded) {
      await safeRemoveTab(tab.id);
      return { success: false, error: "WhatsApp Web non ha caricato in tempo" };
    }
    await sleep(3000);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        const maxWait = 15000;
        const start = Date.now();

        while (Date.now() - start < maxWait) {
          // QR code = not logged in
          const qr = document.querySelector('canvas[aria-label], [data-testid="qrcode"]');
          if (qr) return { success: false, error: "WhatsApp Web non connesso. Scansiona il QR code." };

          // Look for send button with multiple selectors
          const sendBtn =
            document.querySelector('span[data-icon="send"]') ||
            document.querySelector('button[aria-label="Invia"]') ||
            document.querySelector('button[aria-label="Send"]') ||
            document.querySelector('[data-testid="send"]');

          if (sendBtn) {
            const btn = sendBtn.closest("button") || sendBtn;
            btn.click();
            await new Promise(r => setTimeout(r, 1500));
            return { success: true };
          }
          await new Promise(r => setTimeout(r, 500));
        }
        return { success: false, error: "Pulsante invio non trovato." };
      },
    });

    const result = results?.[0]?.result;
    await sleep(500);
    await safeRemoveTab(tab.id);
    return result || { success: false, error: "Nessun risultato dallo script" };
  } catch (err) {
    if (tab?.id) await safeRemoveTab(tab.id);
    return { success: false, error: err.message };
  }
}

// ── Verify WhatsApp session ──

async function verifySession() {
  try {
    const { tab, reused } = await getOrCreateWaTab();
    await sleep(reused ? 1000 : 4000);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const qr = document.querySelector('canvas[aria-label], [data-testid="qrcode"]');
        if (qr) return { success: true, authenticated: false, reason: "qr_required" };
        // #side is the left panel with chat list — means we're logged in
        const side = document.querySelector("#side") || document.querySelector('[data-testid="chatlist"]');
        if (side) return { success: true, authenticated: true };
        return { success: true, authenticated: false, reason: "unknown_state" };
      },
    });

    // Tab stays open — no cleanup needed
    return results?.[0]?.result || { success: false, authenticated: false, reason: "no_result" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Read unread messages (sidebar scan) ──

async function readUnreadMessages() {
  try {
    const { tab, reused } = await getOrCreateWaTab();
    await sleep(reused ? 1500 : 5000);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Check if logged in first
        const qr = document.querySelector('canvas[aria-label], [data-testid="qrcode"]');
        if (qr) return { success: false, error: "WhatsApp Web non connesso. Scansiona il QR code." };

        const messages = [];

        // Strategy 1: data-testid selectors (most reliable)
        let chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');

        // Strategy 2: fallback to role=listitem
        if (!chatItems.length) {
          chatItems = document.querySelectorAll('#pane-side [role="listitem"]');
        }

        // Strategy 3: fallback to divs inside the chat list panel
        if (!chatItems.length) {
          const pane = document.querySelector("#pane-side") || document.querySelector('[data-testid="chatlist"]');
          if (pane) {
            chatItems = pane.querySelectorAll('[tabindex="-1"]');
          }
        }

        for (const chat of chatItems) {
          // Detect unread badge — multiple selector strategies
          const unreadBadge =
            chat.querySelector('[data-testid="icon-unread-count"]') ||
            chat.querySelector('span[aria-label*="non lett"]') ||
            chat.querySelector('span[aria-label*="unread"]') ||
            chat.querySelector('span[aria-label*="mensaje"]');

          // Also check for a visible numeric badge (green circle with number)
          let unreadCount = 0;
          if (unreadBadge) {
            unreadCount = parseInt(unreadBadge.textContent) || 1;
          } else {
            // Look for any small green circle badge
            const badges = chat.querySelectorAll('span');
            for (const b of badges) {
              const style = window.getComputedStyle(b);
              const bg = style.backgroundColor;
              const text = b.textContent.trim();
              // Green background + numeric content = unread badge
              if (text && /^\d+$/.test(text) && bg && (bg.includes("37, 211") || bg.includes("25d366") || bg.includes("00a884"))) {
                unreadCount = parseInt(text) || 1;
                break;
              }
            }
          }

          if (unreadCount === 0) continue;

          // Extract contact name
          const titleEl =
            chat.querySelector('[data-testid="cell-frame-title"] span[title]') ||
            chat.querySelector('span[title][dir="auto"]') ||
            chat.querySelector('span[title]');

          // Extract last message preview
          const lastMsgEl =
            chat.querySelector('[data-testid="last-msg-status"]') ||
            chat.querySelector('span[data-testid="last-msg-status"]') ||
            chat.querySelector('[data-testid="cell-frame-secondary"] span[title]') ||
            chat.querySelector('[data-testid="cell-frame-secondary"] span');

          // Extract timestamp
          const timeEl =
            chat.querySelector('[data-testid="cell-frame-primary-detail"]') ||
            chat.querySelector('div[class] > span[dir="auto"]:last-child');

          const contact = titleEl?.getAttribute("title") || titleEl?.textContent?.trim() || "Sconosciuto";
          const lastMessage = lastMsgEl?.textContent?.trim() || "";
          const time = timeEl?.textContent?.trim() || new Date().toISOString();

          messages.push({
            contact,
            lastMessage,
            time,
            unreadCount,
          });
        }

        return { success: true, messages, scanned: chatItems.length };
      },
    });

    if (!reused) await safeRemoveTab(tab.id);
    const result = results?.[0]?.result;
    return result || { success: false, error: "Nessun risultato dallo script" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Read full conversation from a specific chat ──

async function readChatThread(contactName, maxMessages = 50) {
  try {
    const { tab, reused } = await getOrCreateWaTab();
    await sleep(reused ? 1500 : 5000);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [contactName, maxMessages],
      func: async (targetContact, limit) => {
        // Find and click on the target chat
        const searchBox = document.querySelector('[data-testid="chat-list-search"] [contenteditable="true"]')
          || document.querySelector('[data-testid="search-input"]')
          || document.querySelector('#side [contenteditable="true"]');

        if (!searchBox) return { success: false, error: "Campo ricerca non trovato" };

        // Clear and type contact name
        searchBox.focus();
        searchBox.textContent = "";
        document.execCommand("insertText", false, targetContact);
        await new Promise(r => setTimeout(r, 1500));

        // Click on the first matching chat
        const chatResults = document.querySelectorAll('[data-testid="cell-frame-container"], #pane-side [role="listitem"]');
        let clicked = false;
        for (const chat of chatResults) {
          const title = chat.querySelector('span[title]');
          if (title && title.getAttribute("title").toLowerCase().includes(targetContact.toLowerCase())) {
            chat.click();
            clicked = true;
            break;
          }
        }

        if (!clicked) return { success: false, error: "Chat non trovata per: " + targetContact };

        // Wait for chat messages to load
        await new Promise(r => setTimeout(r, 2000));

        // Extract messages from the conversation panel
        const msgElements = document.querySelectorAll('[data-testid="msg-container"], [data-testid="conversation-panel-messages"] [class*="message"]');
        const messages = [];

        const items = Array.from(msgElements).slice(-limit);
        for (const el of items) {
          const isIncoming = el.querySelector('[data-testid="msg-dblcheck"]') === null
            && el.querySelector('[data-testid="msg-check"]') === null;

          const textEl = el.querySelector('[data-testid="balloon-text"] span, .selectable-text span');
          const timeEl = el.querySelector('[data-testid="msg-meta"] span, [data-pre-plain-text]');

          const text = textEl?.textContent?.trim() || "";
          if (!text) continue;

          let timestamp = "";
          if (timeEl) {
            timestamp = timeEl.textContent?.trim() || "";
          }
          // Try data-pre-plain-text attribute which has full timestamp
          const prePlain = el.querySelector('[data-pre-plain-text]');
          if (prePlain) {
            timestamp = prePlain.getAttribute("data-pre-plain-text") || timestamp;
          }

          messages.push({
            direction: isIncoming ? "inbound" : "outbound",
            text,
            timestamp,
            contact: isIncoming ? targetContact : "me",
          });
        }

        // Clear search to go back to chat list
        const clearBtn = document.querySelector('[data-testid="search-input-clear"]')
          || document.querySelector('[data-testid="x-alt"]');
        if (clearBtn) clearBtn.click();

        return { success: true, messages, contact: targetContact };
      },
    });

    if (!reused) await safeRemoveTab(tab.id);
    return results?.[0]?.result || { success: false, error: "Nessun risultato" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  syncBridgeAcrossOpenTabs().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  syncBridgeAcrossOpenTabs().catch(() => {});
});

// ── Message handler ──

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.source !== "wa-content-bridge") return false;

  if (msg.action === "ping") {
    sendResponse({ success: true, version: "2.0" });
    return false;
  }

  if (msg.action === "verifySession") {
    verifySession().then(sendResponse);
    return true;
  }

  if (msg.action === "sendWhatsApp") {
    if (!msg.phone || !msg.text) {
      sendResponse({ success: false, error: "phone e text richiesti" });
      return false;
    }
    sendWhatsAppMessage(msg.phone, msg.text).then(sendResponse);
    return true;
  }

  if (msg.action === "readUnread") {
    readUnreadMessages().then(sendResponse);
    return true;
  }

  if (msg.action === "readThread") {
    if (!msg.contact) {
      sendResponse({ success: false, error: "contact richiesto" });
      return false;
    }
    readChatThread(msg.contact, msg.maxMessages || 50).then(sendResponse);
    return true;
  }

  sendResponse({ success: false, error: "Azione sconosciuta: " + msg.action });
  return false;
});
