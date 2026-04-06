/**
 * storage-manager.js — Email storage abstraction
 * ────────────────────────────────────────────────
 * Two modes:
 *   - "local":  Downloads .eml files to user's Downloads folder
 *   - "cloud":  Sends to edge function for database storage
 *
 * Both modes keep sync state in chrome.storage.local.
 */

import { DEFAULTS } from "./config.js";

/* ── Sync State ───────────────────────────────────────────────── */

const STATE_KEY = "email_sync_state";

export async function getSyncState() {
  const result = await chrome.storage.local.get(STATE_KEY);
  return result[STATE_KEY] || {
    lastUid: 0,
    totalDownloaded: 0,
    lastSyncAt: null,
    storageMode: DEFAULTS.storageMode,
  };
}

export async function updateSyncState(patch) {
  const current = await getSyncState();
  const updated = { ...current, ...patch };
  await chrome.storage.local.set({ [STATE_KEY]: updated });
  return updated;
}

/* ── Local Download (.eml) ────────────────────────────────────── */

/**
 * Save an email as .eml file in Downloads
 * @param {Object} email — { uid, subject, from, date, raw }
 * @returns {Promise<{success:boolean, filename:string}>}
 */
export async function saveEmailLocally(email) {
  const sanitized = sanitizeFilename(email.subject || "no-subject");
  const dateStr = email.date 
    ? new Date(email.date).toISOString().slice(0, 10) 
    : new Date().toISOString().slice(0, 10);
  const filename = `email/${dateStr}/${sanitized}_${email.uid}.eml`;

  const blob = new Blob([email.raw], { type: "message/rfc822" });
  const dataUrl = await blobToDataUrl(blob);

  return new Promise((resolve) => {
    chrome.downloads.download(
      {
        url: dataUrl,
        filename,
        saveAs: false,
        conflictAction: "uniquify",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, filename, error: chrome.runtime.lastError.message });
        } else {
          resolve({ success: true, filename, downloadId });
        }
      }
    );
  });
}

/**
 * Save a batch of emails locally
 * @param {Array} emails
 * @param {Function} [onProgress] — called with (index, total, email)
 */
export async function saveBatchLocally(emails, onProgress) {
  const results = [];
  for (let i = 0; i < emails.length; i++) {
    const result = await saveEmailLocally(emails[i]);
    results.push(result);
    if (onProgress) onProgress(i + 1, emails.length, emails[i]);
    // Small delay to avoid overwhelming downloads API
    if (i < emails.length - 1) await sleep(200);
  }
  return results;
}

/* ── Cloud Upload ─────────────────────────────────────────────── */

/**
 * Upload emails to cloud via edge function
 * @param {string} proxyUrl — edge function base URL
 * @param {string} authToken — user's auth token
 * @param {Array} emails — array of parsed email objects
 */
export async function uploadToCloud(proxyUrl, authToken, emails) {
  const res = await fetch(`${proxyUrl}/store`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ emails }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ── Stats ────────────────────────────────────────────────────── */

const STATS_KEY = "email_stats";

export async function getStats() {
  const result = await chrome.storage.local.get(STATS_KEY);
  return result[STATS_KEY] || {
    totalEmails: 0,
    lastSyncDuration: 0,
    syncCount: 0,
    errors: 0,
  };
}

export async function updateStats(patch) {
  const current = await getStats();
  const updated = { ...current, ...patch };
  await chrome.storage.local.set({ [STATS_KEY]: updated });
  return updated;
}

/* ── Helpers ──────────────────────────────────────────────────── */

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
