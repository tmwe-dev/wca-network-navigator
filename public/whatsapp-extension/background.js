// ══════════════════════════════════════════════
// WhatsApp Direct Send - Background Service Worker
// Automates sending messages via web.whatsapp.com
// ══════════════════════════════════════════════

const WA_BASE = "https://web.whatsapp.com";

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

async function sendWhatsAppMessage(phone, text) {
  // Use wa.me deep link which WhatsApp Web handles
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

    // Wait for WhatsApp Web to render and show the send button
    await sleep(3000);

    // Try to click the send button
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        // Wait for the chat to load and find the send button
        const maxWait = 15000;
        const start = Date.now();
        
        while (Date.now() - start < maxWait) {
          // Check if we need QR code (not logged in)
          const qrCanvas = document.querySelector("canvas[aria-label]");
          if (qrCanvas) {
            return { success: false, error: "WhatsApp Web non connesso. Scansiona il QR code prima." };
          }

          // Look for the send button (green arrow)
          const sendBtn = document.querySelector('button[aria-label="Invia"], button[aria-label="Send"], span[data-icon="send"]');
          if (sendBtn) {
            const btn = sendBtn.closest("button") || sendBtn;
            btn.click();
            await new Promise(r => setTimeout(r, 1500));
            return { success: true };
          }

          // Also check for the text input to verify we're in a chat
          const input = document.querySelector('div[contenteditable="true"][data-tab="10"]');
          if (input && input.textContent.length > 0) {
            // Text is pre-filled, look harder for send button
            const allBtns = document.querySelectorAll('button');
            for (const b of allBtns) {
              const icon = b.querySelector('span[data-icon="send"]');
              if (icon) {
                b.click();
                await new Promise(r => setTimeout(r, 1500));
                return { success: true };
              }
            }
          }

          await new Promise(r => setTimeout(r, 500));
        }

        return { success: false, error: "Pulsante invio non trovato. Verifica che WhatsApp Web sia connesso." };
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

async function verifySession() {
  let tab;
  try {
    tab = await safeCreateTab(WA_BASE, false);
    const loaded = await waitForLoad(tab.id, 20000);
    if (!loaded) {
      await safeRemoveTab(tab.id);
      return { success: false, authenticated: false, reason: "timeout" };
    }
    await sleep(3000);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const qr = document.querySelector("canvas[aria-label]");
        if (qr) return { success: true, authenticated: false, reason: "qr_required" };
        const side = document.querySelector("#side");
        if (side) return { success: true, authenticated: true };
        return { success: true, authenticated: false, reason: "unknown_state" };
      },
    });

    await safeRemoveTab(tab.id);
    return results?.[0]?.result || { success: false, authenticated: false, reason: "no_result" };
  } catch (err) {
    if (tab?.id) await safeRemoveTab(tab.id);
    return { success: false, error: err.message };
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.source !== "wa-content-bridge") return false;

  if (msg.action === "ping") {
    sendResponse({ success: true, version: "1.0" });
    return false;
  }

  if (msg.action === "verifySession") {
    verifySession().then(sendResponse);
    return true; // async
  }

  if (msg.action === "sendWhatsApp") {
    if (!msg.phone || !msg.text) {
      sendResponse({ success: false, error: "phone e text richiesti" });
      return false;
    }
    sendWhatsAppMessage(msg.phone, msg.text).then(sendResponse);
    return true; // async
  }

  sendResponse({ success: false, error: "Azione sconosciuta: " + msg.action });
  return false;
});
