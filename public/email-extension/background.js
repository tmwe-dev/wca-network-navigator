/**
 * background.js — Service Worker principale
 * ──────────────────────────────────────────
 * Thin message router + sync orchestration.
 * Modules: config, auto-discover, storage-manager, notifier
 */

import { VERSION, DEFAULTS, ERR } from "./config.js";
import { discoverImapServer } from "./auto-discover.js";
import { getSyncState, updateSyncState, saveBatchLocally, uploadToCloud, getStats, updateStats } from "./storage-manager.js";
import { notifyNewEmails } from "./notifier.js";

/* ── State ────────────────────────────────────────────────────── */

let syncing = false;

/* ── Config helpers ───────────────────────────────────────────── */

const CFG_KEY = "email_config";

async function getConfig() {
  const { [CFG_KEY]: cfg } = await chrome.storage.local.get(CFG_KEY);
  return cfg || null;
}

async function saveConfig(cfg) {
  await chrome.storage.local.set({ [CFG_KEY]: cfg });
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
      // Set up alarm if sync interval configured
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
      const result = await testImapConnection(cfg);
      return result;
    }

    case "syncNow": {
      if (syncing) return { success: false, code: ERR.SYNC_IN_PROGRESS, error: "Sincronizzazione in corso" };
      const result = await runSync();
      return result;
    }

    case "getStatus": {
      const [syncState, stats, cfg] = await Promise.all([getSyncState(), getStats(), getConfig()]);
      return { success: true, syncState, stats, config: cfg, syncing };
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

/* ── Alarm handler (periodic sync) ────────────────────────────── */

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

      // Notify
      if (cfg.notificationsEnabled !== false) {
        await notifyNewEmails(emails, true);
      }
    }

    // Update state
    await updateSyncState({
      lastUid: highestUid,
      totalDownloaded: (syncState.totalDownloaded || 0) + downloaded,
      lastSyncAt: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    await updateStats({
      totalEmails: (await getStats()).totalEmails + downloaded,
      lastSyncDuration: duration,
      syncCount: (await getStats()).syncCount + 1,
      errors: (await getStats()).errors + errors,
    });

    return {
      success: true,
      downloaded,
      errors,
      totalInbox,
      highestUid,
      duration,
    };
  } catch (err) {
    await updateStats({ errors: (await getStats()).errors + 1 });
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
    const data = await res.json();
    return { success: true, ...data };
  } catch (err) {
    return { success: false, error: err.message, code: ERR.PROXY_UNREACHABLE };
  }
}

/* ── Install handler ──────────────────────────────────────────── */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    console.log(`[EmailClient] v${VERSION} installato`);
  }
});
