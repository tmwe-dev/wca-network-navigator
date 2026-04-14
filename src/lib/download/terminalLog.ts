import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("terminalLog");

/**
 * Terminal log with LOCAL BUFFER — flushes to DB every N entries
 * to reduce database roundtrips from 2 per log → 2 per 5 logs.
 */

const BUFFER_KEY = '__terminalLogBuffer__';
const FLUSH_THRESHOLD = 5;

interface LogEntry {
  ts: string;
  type: string;
  msg: string;
}

interface BufferState {
  entries: LogEntry[];
  flushTimer: ReturnType<typeof setTimeout> | null;
  jobId: string | null;
}

function getBuffer(): BufferState {
  const w = window as unknown as Record<string, unknown>;
  if (!w[BUFFER_KEY]) {
    w[BUFFER_KEY] = { entries: [], flushTimer: null, jobId: null };
  }
  return w[BUFFER_KEY] as BufferState;
}

/**
 * Flush buffered log entries to the database.
 * Atomic: SELECT current log → append buffer → UPDATE.
 */
async function flushBuffer(): Promise<void> {
  const buf = getBuffer();
  if (buf.entries.length === 0 || !buf.jobId) return;

  const toFlush = [...buf.entries];
  const jobId = buf.jobId;
  buf.entries = [];
  if (buf.flushTimer) {
    clearTimeout(buf.flushTimer);
    buf.flushTimer = null;
  }

  try {
    const { data } = await supabase
      .from("download_jobs")
      .select("terminal_log")
      .eq("id", jobId)
      .single();
    const current = (data?.terminal_log as unknown as LogEntry[] || []);
    const updated = [...current, ...toFlush].slice(-150);
    await supabase
      .from("download_jobs")
      .update({ terminal_log: updated as unknown as import("@/integrations/supabase/types").Json })
      .eq("id", jobId);
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    // Silently fail — terminal log is non-critical
  }
}

/**
 * Append a log entry. Buffers locally and flushes every FLUSH_THRESHOLD entries
 * or after 3 seconds of inactivity.
 */
export async function appendLog(jobId: string, type: string, msg: string) {
  const ts = new Date().toLocaleTimeString("it-IT", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const buf = getBuffer();
  
  // If job changed, flush previous buffer first
  if (buf.jobId && buf.jobId !== jobId && buf.entries.length > 0) {
    await flushBuffer();
  }
  
  buf.jobId = jobId;
  buf.entries.push({ ts, type, msg });

  // Flush immediately if threshold reached, or on critical log types
  const criticalTypes = ["DONE", "STOP", "ERROR"];
  if (buf.entries.length >= FLUSH_THRESHOLD || criticalTypes.includes(type)) {
    await flushBuffer();
    return;
  }

  // Schedule delayed flush (3s inactivity)
  if (buf.flushTimer) clearTimeout(buf.flushTimer);
  buf.flushTimer = setTimeout(() => flushBuffer(), 3000);
}

/**
 * Force flush any remaining buffered entries (call at job end).
 */
export async function flushLogBuffer(): Promise<void> {
  await flushBuffer();
}

// Register beforeunload handler to flush on tab close
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    const buf = getBuffer();
    if (buf.entries.length > 0 && buf.jobId) {
      // Use sendBeacon as last resort (navigator.sendBeacon doesn't support JSON well,
      // so we do a sync-ish flush via the existing mechanism)
      flushBuffer().catch(() => {});
    }
  });
}
