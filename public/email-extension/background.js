/**
 * background.js — Service Worker principale v2.0
 * ──────────────────────────────────────────────
 * Message router + sync + side panel + email cache
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
  // Keep max 200 emails in cache (metadata + body)
  const capped = emails.slice(0, 200);
  await chrome.storage.local.set({ [EMAILS_KEY]: capped });
}

/* ── Message Router ───────────────────────────────────────────── */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg?.action) return false;
  handleMessage(msg).then(sendResponse).catch(err =>
    sendResponse({ success: false, error: err.message, code: err.code || "UNKNOWN" })
  );
  return true; // async
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
      const updated = emails.map(e => e.uid === msg.uid ? { ...e, unread: false } : e);
      await setCachedEmails(updated);
      return { success: true };
    }

    case "toggleFlag": {
      const emails = await getCachedEmails();
      const updated = emails.map(e => e.uid === msg.uid ? { ...e, flagged: msg.flagged } : e);
      await setCachedEmails(updated);
      return { success: true };
    }

    case "openSidePanel": {
      try {
        // Open side panel (requires user gesture from popup)
        await chrome.sidePanel.setOptions({ enabled: true });
        // If emailId passed, we'll send it after panel opens
        if (msg.emailId) {
          // Small delay to let panel load
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: "showEmail", emailId: msg.emailId });
          }, 500);
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

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

/* ── Core sync ────────────────────────────────────────────────── */

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

    // Fetch new emails from proxy
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
      // Store based on mode
      if (storageMode === "local") {
        const results = await saveBatchLocally(emails);
        downloaded = results.filter(r => r.success).length;
        errors = results.filter(r => !r.success).length;
      } else {
        await uploadToCloud(cfg.proxyUrl, cfg.authToken, emails);
        downloaded = emails.length;
      }

      // Cache emails for side panel viewing
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
          raw: storageMode === "local" ? null : e.raw, // don't cache raw in local mode
          unread: true,
          flagged: false,
          hasAttachments: !!(e.attachments?.length),
          attachments: e.attachments || [],
        }));

      const merged = [...newEmails, ...existingEmails].slice(0, 200);
      await setCachedEmails(merged);

      // Notify
      if (cfg.notificationsEnabled !== false) {
        await notifyNewEmails(emails, true);
      }

      // Notify side panel of updates
      try {
        chrome.runtime.sendMessage({ action: "emailsUpdated" });
      } catch { /* panel might not be open */ }
    }

    // Update state
    await updateSyncState({
      lastUid: highestUid,
      totalDownloaded: (syncState.totalDownloaded || 0) + downloaded,
      lastSyncAt: new Date().toISOString(),
    });

    const prevStats = await getStats();
    const duration = Date.now() - startTime;
    await updateStats({
      totalEmails: prevStats.totalEmails + downloaded,
      lastSyncDuration: duration,
      syncCount: prevStats.syncCount + 1,
      errors: prevStats.errors + errors,
    });

    return { success: true, downloaded, errors, totalInbox, highestUid, duration };
  } catch (err) {
    const prevStats = await getStats();
    await updateStats({ errors: prevStats.errors + 1 });
    return { success: false, error: err.message, code: err.code || ERR.DOWNLOAD_FAILED };
  } finally {
    syncing = false;
  }
}

/* ── Test IMAP connection ─────────────────────────────────────── */

async function testImapConnection(cfg) {
  try {
    const res = await fetch(`${cfg.proxyUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cfg.email,
        password: cfg.password,
        host: cfg.imapHost,
        port: cfg.imapPort,
        tls: cfg.imapTls !== false,
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

/* ── Install handler ──────────────────────────────────────────── */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    console.log(`[EmailClient] v${VERSION} installato`);
    // Enable side panel
    chrome.sidePanel?.setOptions({ enabled: true }).catch(() => {});
  }
});

/* ── Action click → open side panel ───────────────────────────── */
chrome.action.onClicked.addListener((_tab) => {
  // This fires only if default_popup is removed; we keep popup but
  // this is a fallback for programmatic opening
});
