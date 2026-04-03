/**
 * Background email sync singleton — survives page navigation.
 * Downloads one email at a time with minimal delay.
 * Emits per-email data for the live download viewer.
 */

import { supabase } from "@/integrations/supabase/client";

export interface DownloadedEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  bodyHtml?: string;
  bodyText?: string;
  timestamp: number; // when downloaded
}

export interface BgSyncProgress {
  downloaded: number;
  skipped: number;
  remaining: number;
  batch: number;
  lastSubject: string;
  status: "idle" | "syncing" | "done" | "error";
  errorMessage?: string;
  startedAt?: number;
  elapsedSeconds: number;
}

type ProgressListener = (p: BgSyncProgress) => void;
type EmailListener = (e: DownloadedEmail) => void;

const INITIAL: BgSyncProgress = {
  downloaded: 0, skipped: 0, remaining: 0, batch: 0, lastSubject: "", status: "idle", elapsedSeconds: 0,
};

let _progress: BgSyncProgress = { ...INITIAL };
let _running = false;
let _abort = false;
let _timer: ReturnType<typeof setInterval> | null = null;
const _progressListeners = new Set<ProgressListener>();
const _emailListeners = new Set<EmailListener>();
let _emailHistory: DownloadedEmail[] = [];

function notifyProgress() {
  _progressListeners.forEach(fn => fn({ ..._progress }));
}

function notifyEmail(e: DownloadedEmail) {
  _emailHistory.push(e);
  // Keep max 500 in memory
  if (_emailHistory.length > 500) _emailHistory = _emailHistory.slice(-500);
  _emailListeners.forEach(fn => fn(e));
}

export function bgSyncSubscribe(fn: ProgressListener): () => void {
  _progressListeners.add(fn);
  fn({ ..._progress });
  return () => { _progressListeners.delete(fn); };
}

export function bgSyncSubscribeEmails(fn: EmailListener): () => void {
  _emailListeners.add(fn);
  return () => { _emailListeners.delete(fn); };
}

export function bgSyncGetEmailHistory(): DownloadedEmail[] {
  return [..._emailHistory];
}

export function bgSyncGetProgress(): BgSyncProgress {
  return { ..._progress };
}

export function bgSyncIsRunning(): boolean {
  return _running;
}

async function callCheckInbox(): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Non autenticato");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/check-inbox`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Errore sconosciuto" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function bgSyncStart() {
  if (_running) return;
  _running = true;
  _abort = false;
  _emailHistory = [];

  let totalDownloaded = 0;
  let batchNum = 0;
  const startedAt = Date.now();

  _timer = setInterval(() => {
    _progress = { ..._progress, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) };
    notifyProgress();
  }, 1000);

  _progress = { downloaded: 0, batch: 0, lastSubject: "", status: "syncing", startedAt, elapsedSeconds: 0 };
  notifyProgress();

  try {
    let consecutiveErrors = 0;
    const MAX_RETRIES = 3;

    while (!_abort) {
      batchNum++;
      let result: any;

      try {
        result = await callCheckInbox();
        consecutiveErrors = 0;
      } catch (batchErr: any) {
        consecutiveErrors++;
        console.warn(`[bg-sync] Batch ${batchNum} error (${consecutiveErrors}/${MAX_RETRIES}): ${batchErr.message}`);

        if (consecutiveErrors >= MAX_RETRIES) {
          throw batchErr;
        }

        _progress = {
          ..._progress, batch: batchNum,
          lastSubject: `⚠️ Errore temporaneo, riprovo... (${consecutiveErrors}/${MAX_RETRIES})`,
        };
        notifyProgress();
        await new Promise(r => setTimeout(r, 2000 * consecutiveErrors));
        continue;
      }

      const hasMore = typeof result.has_more === "boolean"
        ? result.has_more
        : typeof result.remaining === "number"
          ? result.remaining > 0
          : result.total > 0;

      if (result.total > 0) {
        totalDownloaded += result.total;

        // Emit each downloaded email for live viewer
        const msgs = result.messages || [];
        for (const msg of msgs) {
          notifyEmail({
            id: msg.id || `batch-${batchNum}-${Math.random().toString(36).slice(2)}`,
            subject: msg.subject || "(senza oggetto)",
            from: msg.from_address || msg.from || "",
            date: msg.email_date || msg.date || new Date().toISOString(),
            bodyHtml: msg.body_html || undefined,
            bodyText: msg.body_text || undefined,
            timestamp: Date.now(),
          });
        }

        const lastMsg = msgs[msgs.length - 1];
        _progress = {
          ..._progress,
          downloaded: totalDownloaded,
          batch: batchNum,
          lastSubject: lastMsg?.subject || _progress.lastSubject,
          status: "syncing",
        };
      } else {
        _progress = { ..._progress, batch: batchNum, status: "syncing" };
      }
      notifyProgress();

      if (!hasMore) break;

      // Minimal delay — just yield to event loop
      await new Promise(r => setTimeout(r, 100));
    }

    _progress = { ..._progress, status: "done", downloaded: totalDownloaded, batch: batchNum };
    notifyProgress();
  } catch (err: any) {
    _progress = { ..._progress, status: "error", errorMessage: err.message };
    notifyProgress();
  } finally {
    if (_timer) clearInterval(_timer);
    _timer = null;
    _running = false;
  }
}

export function bgSyncStop() {
  _abort = true;
}

export function bgSyncReset() {
  _progress = { ...INITIAL };
  _emailHistory = [];
  notifyProgress();
}
