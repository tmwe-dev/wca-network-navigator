/**
 * Background email sync singleton — survives page navigation.
 * Downloads one email at a time with minimal delay.
 * Emits per-email data for the live download viewer.
 */

import { callCheckInbox } from "@/lib/checkInbox";
import { createLogger } from "@/lib/log";

const log = createLogger("backgroundSync");

export interface DownloadedEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  bodyHtml?: string;
  bodyText?: string;
  timestamp: number;
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
  downloaded: 0,
  skipped: 0,
  remaining: 0,
  batch: 0,
  lastSubject: "",
  status: "idle",
  elapsedSeconds: 0,
};

let progress: BgSyncProgress = { ...INITIAL };
let running = false;
let abortSync = false;
let timer: ReturnType<typeof setInterval> | null = null;
const progressListeners = new Set<ProgressListener>();
const emailListeners = new Set<EmailListener>();
let emailHistory: DownloadedEmail[] = [];

function notifyProgress() {
  progressListeners.forEach((fn) => fn({ ...progress }));
}

function notifyEmail(email: DownloadedEmail) {
  emailHistory = [email, ...emailHistory.filter((item) => item.id !== email.id)].slice(0, 500);
  emailListeners.forEach((fn) => fn(email));
}

export function bgSyncSubscribe(fn: ProgressListener): () => void {
  progressListeners.add(fn);
  fn({ ...progress });
  return () => {
    progressListeners.delete(fn);
  };
}

export function bgSyncSubscribeEmails(fn: EmailListener): () => void {
  emailListeners.add(fn);
  return () => {
    emailListeners.delete(fn);
  };
}

export function bgSyncGetEmailHistory(): DownloadedEmail[] {
  return [...emailHistory];
}

export function bgSyncGetProgress(): BgSyncProgress {
  return { ...progress };
}

export function bgSyncIsRunning(): boolean {
  return running;
}

export async function bgSyncStart() {
  if (running) return;

  running = true;
  abortSync = false;
  emailHistory = [];

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let batchNum = 0;
  const startedAt = Date.now();

  timer = setInterval(() => {
    progress = { ...progress, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) };
    notifyProgress();
  }, 1000);

  progress = {
    downloaded: 0,
    skipped: 0,
    remaining: 0,
    batch: 0,
    lastSubject: "",
    status: "syncing",
    startedAt,
    elapsedSeconds: 0,
  };
  notifyProgress();

  try {
    let consecutiveErrors = 0;
    const MAX_RETRIES = 10;

    while (!abortSync) {
      batchNum += 1;
      let result: { total: number; has_more?: boolean; remaining?: number; messages?: Array<Record<string, unknown>> };

      try {
        result = await callCheckInbox() as typeof result;
        consecutiveErrors = 0;
      } catch (batchErr: unknown) {
        consecutiveErrors += 1;
        const errMsg = batchErr instanceof Error ? batchErr.message : String(batchErr);
        log.warn("batch error", { batchNum, consecutiveErrors, maxRetries: MAX_RETRIES, message: errMsg });

        if (consecutiveErrors >= MAX_RETRIES) {
          throw batchErr;
        }

        progress = {
          ...progress,
          batch: batchNum,
          lastSubject: `⚠️ Errore temporaneo, riprovo... (${consecutiveErrors}/${MAX_RETRIES})`,
        };
        notifyProgress();
        await new Promise((resolve) => setTimeout(resolve, 2000 * consecutiveErrors));
        continue;
      }

      const hasMore = typeof result.has_more === "boolean"
        ? result.has_more
        : typeof result.remaining === "number"
          ? result.remaining > 0
          : result.total > 0;

      const serverRemaining = typeof result.remaining === "number" ? result.remaining : 0;
      const messages = Array.isArray(result.messages) ? result.messages : [];

      if (result.total > 0) {
        totalDownloaded += result.total;

        for (const message of messages) {
          notifyEmail({
            id: message.id || `batch-${batchNum}-${Math.random().toString(36).slice(2)}`,
            subject: message.subject || "(senza oggetto)",
            from: message.from_address || message.from || "",
            date: message.email_date || message.date || new Date().toISOString(),
            bodyHtml: message.body_html || undefined,
            bodyText: message.body_text || undefined,
            timestamp: Date.now(),
          });
        }

        const lastMsg = messages[messages.length - 1];
        progress = {
          ...progress,
          downloaded: totalDownloaded,
          skipped: totalSkipped,
          remaining: serverRemaining,
          batch: batchNum,
          lastSubject: lastMsg?.subject || progress.lastSubject,
          status: "syncing",
        };
      } else {
        totalSkipped += 1;
        progress = {
          ...progress,
          batch: batchNum,
          skipped: totalSkipped,
          remaining: serverRemaining,
          lastSubject: hasMore ? "⏩ Scansione duplicati..." : progress.lastSubject,
          status: "syncing",
        };
      }

      notifyProgress();
      if (!hasMore) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    progress = {
      ...progress,
      status: "done",
      downloaded: totalDownloaded,
      skipped: totalSkipped,
      batch: batchNum,
    };
    notifyProgress();
  } catch (err: unknown) {
    progress = { ...progress, status: "error", errorMessage: err instanceof Error ? err.message : String(err) };
    notifyProgress();
  } finally {
    if (timer) clearInterval(timer);
    timer = null;
    running = false;
  }
}

export function bgSyncStop() {
  abortSync = true;
}

export function bgSyncReset() {
  progress = { ...INITIAL };
  emailHistory = [];
  notifyProgress();
}
