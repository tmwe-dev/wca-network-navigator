/**
 * notifier.js — Push notification manager
 * ─────────────────────────────────────────
 * Manages Chrome notifications for new emails,
 * respects user preferences, deduplicates.
 */

const NOTIFIED_KEY = "notified_uids";
const MAX_TRACKED = 500;

/**
 * Show notification for new emails
 * @param {Array} newEmails — [{uid, from, subject, date}]
 * @param {boolean} enabled — whether notifications are enabled
 */
export async function notifyNewEmails(newEmails, enabled = true) {
  if (!enabled || !newEmails.length) return;

  // Deduplicate against already-notified UIDs
  const { [NOTIFIED_KEY]: seen = [] } = await chrome.storage.local.get(NOTIFIED_KEY);
  const seenSet = new Set(seen);
  const fresh = newEmails.filter(e => !seenSet.has(e.uid));

  if (!fresh.length) return;

  if (fresh.length === 1) {
    const email = fresh[0];
    chrome.notifications.create(`email-${email.uid}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: extractName(email.from) || "Nuova email",
      message: email.subject || "(nessun oggetto)",
      priority: 1,
    });
  } else {
    chrome.notifications.create(`email-batch-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: `${fresh.length} nuove email`,
      message: fresh.slice(0, 3).map(e => 
        `${extractName(e.from)}: ${(e.subject || "").slice(0, 40)}`
      ).join("\n"),
      priority: 1,
    });
  }

  // Track notified UIDs (keep bounded)
  const updated = [...seen, ...fresh.map(e => e.uid)].slice(-MAX_TRACKED);
  await chrome.storage.local.set({ [NOTIFIED_KEY]: updated });
}

/**
 * Clear the notification history
 */
export async function clearNotificationHistory() {
  await chrome.storage.local.remove(NOTIFIED_KEY);
}

/* ── Helpers ──────────────────────────────────────────────────── */

function extractName(fromStr) {
  if (!fromStr) return "";
  // "John Doe <john@example.com>" → "John Doe"
  const match = fromStr.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : fromStr.split("@")[0];
}
