/**
 * background.js — Service Worker v4.0
 * ────────────────────────────────────
 * Message router + sync + send (Email/WhatsApp/LinkedIn) + side panel
 */

import { VERSION, DEFAULTS, ERR, CHANNELS } from "./config.js";
import { discoverImapServer } from "./auto-discover.js";
import {
  getSyncState, updateSyncState,
  saveBatchLocally, uploadToCloud,
  getStats, updateStats
} from "./storage-manager.js";
import { notifyNewEmails } from "./notifier.js";

/* ── State ────────────────────────────────────────────────────── */

let syncing = false;

/* ── Config helpers ───────────────────────────────────────────── */

const CFG_KEY = "email_config";
const EMAILS_KEY = "cached_emails";
const SENT_KEY = "sent_log";

async function getConfig() {
  const { [CFG_KEY]: cfg } = await chrome.storage.local.get(CFG_KEY);
  return cfg || null;
}

async function saveConfig(cfg) {
  await chrome.storage.local.set({ [CFG_KEY]: cfg });
}

async function getCachedEmails() {
  const { [EMAILS_KEY]: emails } = await chrome.storage.local.get(EMAILS_KEY);
  return emails || [];
}

async function setCachedEmails(emails) {
  await chrome.storage.local.set({ [EMAILS_KEY]: emails.slice(0, 200) });
}

async function logSent(channel, recipient, preview) {
  const { [SENT_KEY]: log } = await chrome.storage.local.get(SENT_KEY);
  const entries = log || [];
  entries.unshift({ channel, recipient, preview: (preview || "").slice(0, 80), sentAt: new Date().toISOString() });
  await chrome.storage.local.set({ [SENT_KEY]: entries.slice(0, 500) });
  // Update sent count
  const stats = await getStats();
  await updateStats({ sentCount: (stats.sentCount || 0) + 1 });
}

/* ── Message Router ───────────────────────────────────────────── */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg?.action) return false;
  handleMessage(msg).then(sendResponse).catch(err =>
    sendResponse({ success: false, error: err.message, code: err.code || "UNKNOWN" })
  );
  return true;
});

async function handleMessage(msg) {
  switch (msg.action) {
    case "ping":
      return { success: true, version: VERSION };

    case "getConfig":
      return { success: true, config: await getConfig() };

    case "saveConfig": {
      await saveConfig(msg.config);
      if (msg.config.syncInterval) {
        chrome.alarms.create("email-sync", { periodInMinutes: msg.config.syncInterval });
      }
      return { success: true };
    }

    case "discover": {
      const cfg = await getConfig();
      const proxyUrl = cfg?.proxyUrl || null;
      const result = await discoverImapServer(msg.email, proxyUrl);
      return { success: true, server: result };
    }

    case "testConnection": {
      const cfg = await getConfig();
      if (!cfg?.proxyUrl) return { success: false, code: ERR.PROXY_UNREACHABLE, error: "Proxy non configurato" };
      return await testImapConnection(cfg);
    }

    case "syncNow": {
      if (syncing) return { success: false, code: ERR.SYNC_IN_PROGRESS, error: "Sincronizzazione in corso" };
      return await runSync();
    }

    case "getStatus": {
      const [syncState, stats, cfg] = await Promise.all([getSyncState(), getStats(), getConfig()]);
      return { success: true, syncState, stats, config: cfg, syncing };
    }

    case "getRecentEmails": {
      const emails = await getCachedEmails();
      return { success: true, emails };
    }

    case "markRead": {
      const emails = await getCachedEmails();
      await setCachedEmails(emails.map(e => e.uid === msg.uid ? { ...e, unread: false } : e));
      return { success: true };
    }

    case "toggleFlag": {
      const emails = await getCachedEmails();
      await setCachedEmails(emails.map(e => e.uid === msg.uid ? { ...e, flagged: msg.flagged } : e));
      return { success: true };
    }

    case "openSidePanel": {
      try {
        await chrome.sidePanel.setOptions({ enabled: true });
        if (msg.emailId) {
          setTimeout(() => chrome.runtime.sendMessage({ action: "showEmail", emailId: msg.emailId }), 500);
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    // ── SEND HANDLERS ──

    case "sendEmail":
      return await handleSendEmail(msg);

    case "sendWhatsApp":
      return await handleSendWhatsApp(msg);

    case "sendLinkedIn":
      return await handleSendLinkedIn(msg);

    case "resetState": {
      await chrome.storage.local.clear();
      syncing = false;
      chrome.alarms.clearAll();
      return { success: true };
    }

    default:
      return { success: false, error: `Azione sconosciuta: ${msg.action}` };
  }
}

/* ── Alarm handler ────────────────────────────────────────────── */

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "email-sync" && !syncing) {
    await runSync();
  }
});

/* ══════════════════════════════════════════════════════════════════
   SEND — Email via SMTP proxy
   ══════════════════════════════════════════════════════════════════ */

async function handleSendEmail(msg) {
  const cfg = await getConfig();
  if (!cfg?.email || !cfg?.proxyUrl) {
    return { success: false, code: ERR.NO_CREDENTIALS, error: "Email non configurata" };
  }

  const { to, cc, subject, body } = msg;
  if (!to) return { success: false, code: ERR.SEND_FAILED, error: "Destinatario mancante" };

  try {
    const res = await fetch(`${cfg.proxyUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cfg.email,
        password: cfg.password,
        smtpHost: cfg.smtpHost || cfg.imapHost?.replace("imap", "smtp"),
        smtpPort: cfg.smtpPort || 587,
        smtpSecurity: cfg.smtpSecurity || "starttls",
        to,
        cc: cc || undefined,
        subject: subject || "(senza oggetto)",
        body: body || "",
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { success: false, code: ERR.SEND_FAILED, error: err.error || "Invio fallito" };
    }

    const result = await res.json();
    await logSent("email", to, subject);
    return { success: true, messageId: result.messageId };
  } catch (err) {
    return { success: false, code: ERR.SEND_FAILED, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════════
   SEND — WhatsApp via tab injection
   ══════════════════════════════════════════════════════════════════ */

async function handleSendWhatsApp(msg) {
  const { phone, text } = msg;
  if (!phone || !text) return { success: false, code: ERR.SEND_FAILED, error: "Numero o messaggio mancante" };

  // Normalize phone: remove spaces, dashes, parentheses
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");

  try {
    // Find or open WhatsApp Web tab
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    let tabId;

    if (tabs.length > 0) {
      tabId = tabs[0].id;
      // Navigate to chat with this number
      await chrome.tabs.update(tabId, {
        url: `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`,
        active: true,
      });
    } else {
      // Open new tab
      const tab = await chrome.tabs.create({
        url: `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`,
        active: true,
      });
      tabId = tab.id;
    }

    // Wait for page to load then attempt auto-send
    await waitForTabLoaded(tabId, 15000);
    await sleep(5000); // Wait for WA to render

    // Try to click send button
    const sendResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Try multiple send button selectors
        const selectors = [
          '[data-testid="send"]',
          'button[aria-label*="Send"]',
          'button[aria-label*="Invia"]',
          'span[data-icon="send"]',
        ];

        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const btn = el.closest("button") || el;
            btn.click();
            return { success: true, method: "auto-send" };
          }
        }

        // Message is pre-filled, user just needs to press Enter
        return { success: true, method: "prefilled", note: "Messaggio precompilato — premi Invio per inviare" };
      },
    });

    const result = sendResult?.[0]?.result || { success: false, error: "Iniezione fallita" };
    if (result.success) {
      await logSent("whatsapp", phone, text);
    }
    return result;
  } catch (err) {
    return { success: false, code: ERR.INJECT_FAILED, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════════
   SEND — LinkedIn via tab injection
   ══════════════════════════════════════════════════════════════════ */

async function handleSendLinkedIn(msg) {
  const { recipient, text } = msg;
  if (!recipient || !text) return { success: false, code: ERR.SEND_FAILED, error: "Destinatario o messaggio mancante" };

  try {
    const isUrl = recipient.startsWith("http");
    let tabId;

    if (isUrl) {
      // Direct profile URL — open messaging overlay
      const profileUrl = recipient.replace(/\/$/, "");
      const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });

      if (tabs.length > 0) {
        tabId = tabs[0].id;
        await chrome.tabs.update(tabId, { url: profileUrl, active: true });
      } else {
        const tab = await chrome.tabs.create({ url: profileUrl, active: true });
        tabId = tab.id;
      }

      await waitForTabLoaded(tabId, 15000);
      await sleep(4000);

      // Click "Message" button on profile
      const clickResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const btns = Array.from(document.querySelectorAll("button"));
          const msgBtn = btns.find(b => /^(message|messaggio)/i.test(b.textContent.trim()));
          if (msgBtn) { msgBtn.click(); return { success: true }; }
          return { success: false, error: "Pulsante Messaggio non trovato" };
        },
      });

      if (!clickResult?.[0]?.result?.success) {
        return { success: false, code: ERR.INJECT_FAILED, error: clickResult?.[0]?.result?.error || "Pulsante Messaggio non trovato" };
      }

      await sleep(3000);
    } else {
      // Search for person by name
      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(recipient)}`;
      const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });

      if (tabs.length > 0) {
        tabId = tabs[0].id;
        await chrome.tabs.update(tabId, { url: searchUrl, active: true });
      } else {
        const tab = await chrome.tabs.create({ url: searchUrl, active: true });
        tabId = tab.id;
      }

      await waitForTabLoaded(tabId, 15000);
      await sleep(4000);

      // Click first "Message" button in search results
      const clickResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const btns = Array.from(document.querySelectorAll("button"));
          const msgBtn = btns.find(b => /^(message|messaggio)/i.test(b.textContent.trim()) && b.offsetParent !== null);
          if (msgBtn) { msgBtn.click(); return { success: true }; }
          return { success: false, error: "Nessun risultato trovato o pulsante Messaggio non disponibile" };
        },
      });

      if (!clickResult?.[0]?.result?.success) {
        return { success: false, code: ERR.INJECT_FAILED, error: clickResult?.[0]?.result?.error || "Impossibile aprire la chat" };
      }

      await sleep(3000);
    }

    // Type and send the message
    const sendResult = await chrome.scripting.executeScript({
      target: { tabId },
      args: [text],
      func: (messageText) => {
        // Find the message input (contenteditable div or textbox)
        const selectors = [
          '[role="textbox"][contenteditable="true"]',
          '.msg-form__contenteditable [contenteditable="true"]',
          'div[data-placeholder][contenteditable="true"]',
        ];

        let textbox = null;
        for (const sel of selectors) {
          textbox = document.querySelector(sel);
          if (textbox) break;
        }

        if (!textbox) {
          return { success: false, error: "Campo messaggio non trovato" };
        }

        // Focus and type using modern input method
        textbox.focus();
        textbox.innerHTML = "";

        // Use InputEvent for reliable text insertion
        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/plain", messageText);
        const pasteEvent = new InputEvent("insertFromPaste", {
          inputType: "insertFromPaste",
          data: messageText,
          dataTransfer,
          bubbles: true,
          cancelable: true,
        });
        textbox.dispatchEvent(pasteEvent);

        // Fallback: direct text content setting
        if (!textbox.textContent || textbox.textContent.trim() !== messageText.trim()) {
          textbox.textContent = messageText;
          textbox.dispatchEvent(new Event("input", { bubbles: true }));
        }

        // Find and click send button
        setTimeout(() => {
          const sendBtns = Array.from(document.querySelectorAll("button"));
          const sendBtn = sendBtns.find(b => {
            const label = (b.getAttribute("aria-label") || b.textContent || "").toLowerCase();
            return /^(send|invia)$/i.test(label.trim()) || /send|invia/i.test(b.getAttribute("type") || "");
          }) || document.querySelector('.msg-form__send-button, button[type="submit"]');

          if (sendBtn && sendBtn.offsetParent !== null) {
            sendBtn.click();
          }
        }, 500);

        return { success: true, method: "inject" };
      },
    });

    const result = sendResult?.[0]?.result || { success: false, error: "Iniezione fallita" };
    if (result.success) {
      await logSent("linkedin", recipient, text);
    }
    return result;
  } catch (err) {
    return { success: false, code: ERR.INJECT_FAILED, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════════
   SYNC — Core email sync (unchanged)
   ══════════════════════════════════════════════════════════════════ */

async function runSync() {
  const cfg = await getConfig();
  if (!cfg?.email || !cfg?.proxyUrl) {
    return { success: false, code: ERR.NO_CREDENTIALS, error: "Configurazione incompleta" };
  }

  syncing = true;
  const startTime = Date.now();
  let downloaded = 0;
  let errors = 0;

  try {
    const syncState = await getSyncState();
    const storageMode = cfg.storageMode || DEFAULTS.storageMode;

    const res = await fetch(`${cfg.proxyUrl}/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cfg.email,
        password: cfg.password,
        host: cfg.imapHost,
        port: cfg.imapPort,
        tls: cfg.imapTls !== false,
        lastUid: syncState.lastUid,
        batchSize: cfg.batchSize || DEFAULTS.batchSize,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Errore proxy" }));
      throw Object.assign(new Error(err.error || `HTTP ${res.status}`), { code: ERR.PROXY_UNREACHABLE });
    }

    const { emails = [], highestUid = syncState.lastUid, totalInbox = 0 } = await res.json();

    if (emails.length > 0) {
      if (storageMode === "local") {
        const results = await saveBatchLocally(emails);
        downloaded = results.filter(r => r.success).length;
        errors = results.filter(r => !r.success).length;
      } else {
        await uploadToCloud(cfg.proxyUrl, cfg.authToken, emails);
        downloaded = emails.length;
      }

      const existingEmails = await getCachedEmails();
      const existingUids = new Set(existingEmails.map(e => e.uid));
      const newEmails = emails
        .filter(e => !existingUids.has(e.uid))
        .map(e => ({
          uid: e.uid,
          subject: e.subject || "(senza oggetto)",
          from: e.from || "",
          to: e.to || "",
          date: e.date || new Date().toISOString(),
          snippet: (e.bodyText || "").slice(0, 120),
          bodyHtml: e.bodyHtml || null,
          bodyText: e.bodyText || null,
          raw: storageMode === "local" ? null : e.raw,
          unread: true,
          flagged: false,
          hasAttachments: !!(e.attachments?.length),
          attachments: e.attachments || [],
        }));

      await setCachedEmails([...newEmails, ...existingEmails].slice(0, 200));

      if (cfg.notificationsEnabled !== false) {
        await notifyNewEmails(emails, true);
      }

      try { chrome.runtime.sendMessage({ action: "emailsUpdated" }); } catch { }
    }

    await updateSyncState({
      lastUid: highestUid,
      totalDownloaded: (syncState.totalDownloaded || 0) + downloaded,
      lastSyncAt: new Date().toISOString(),
    });

    const prevStats = await getStats();
    await updateStats({
      totalEmails: prevStats.totalEmails + downloaded,
      lastSyncDuration: Date.now() - startTime,
      syncCount: prevStats.syncCount + 1,
      errors: prevStats.errors + errors,
    });

    return { success: true, downloaded, errors, totalInbox, highestUid, duration: Date.now() - startTime };
  } catch (err) {
    const prevStats = await getStats();
    await updateStats({ errors: prevStats.errors + 1 });
    return { success: false, error: err.message, code: err.code || ERR.DOWNLOAD_FAILED };
  } finally {
    syncing = false;
  }
}

/* ── Utility ──────────────────────────────────────────────────── */

async function testImapConnection(cfg) {
  try {
    const res = await fetch(`${cfg.proxyUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cfg.email, password: cfg.password,
        host: cfg.imapHost, port: cfg.imapPort, tls: cfg.imapTls !== false,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Test fallito" }));
      return { success: false, error: err.error, code: ERR.AUTH_FAILED };
    }
    return { success: true, ...(await res.json()) };
  } catch (err) {
    return { success: false, error: err.message, code: ERR.PROXY_UNREACHABLE };
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForTabLoaded(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // Resolve anyway, page might be partially loaded
    }, timeoutMs);

    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/* ── Install handler ──────────────────────────────────────────── */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    console.log(`[CommHub] v${VERSION} installato — Side Panel mode`);
  }
  // Always ensure side panel opens on icon click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.sidePanel.setOptions({ enabled: true }).catch(() => {});
});

// Ensure side panel behavior is set on startup too
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
