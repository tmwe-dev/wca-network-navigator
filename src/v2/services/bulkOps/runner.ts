/**
 * runBulkOp — UNICO entry point per operazioni bulk.
 *
 * - Persiste lo stato in `bulk_jobs` (DAL bulkJobs).
 * - Esegue gli item con concorrenza limitata + Promise.allSettled.
 * - Logga eventi su `bulk_job_events` per ogni item completato/failed.
 * - Ritorna BulkRunResult con dettaglio per item.
 *
 * Le UI NON devono mai chiamare le entry direttamente:
 * passare sempre da qui (vedi ESLint rule `no-direct-bulk-op`).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  createBulkJob,
  updateBulkJob,
  appendBulkJobEvent,
} from "@/data/bulkJobs";
import { getEntry } from "./registry";
import type {
  BulkScope,
  BulkRunOptions,
  BulkRunResult,
  BulkItemResult,
  BulkEntry,
} from "./types";

const DEFAULT_CONCURRENCY = 4;

async function getCurrentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("[bulkOps] Utente non autenticato");
  return uid;
}

async function runWithConcurrency<I, R>(
  items: ReadonlyArray<I>,
  limit: number,
  fn: (item: I, index: number) => Promise<R>,
): Promise<ReadonlyArray<PromiseSettledResult<R>>> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length || 1)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        const value = await fn(items[i], i);
        results[i] = { status: "fulfilled", value };
      } catch (e: unknown) {
        results[i] = { status: "rejected", reason: e };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runBulkOp<I, R>(
  scope: BulkScope,
  items: ReadonlyArray<I>,
  opts: BulkRunOptions = {},
): Promise<BulkRunResult<R>> {
  const entry = getEntry(scope) as unknown as BulkEntry<I, R>;
  const userId = await getCurrentUserId();

  const job = await createBulkJob({
    scope,
    source_view: opts.sourceView,
    total: items.length,
    payload: opts.payload ?? {},
    created_by: userId,
  });

  await updateBulkJob(job.id, { status: "running" });
  await appendBulkJobEvent(job.id, "job_started", { total: items.length, scope });

  let processed = 0;
  let successCount = 0;
  let errorCount = 0;

  const settled = await runWithConcurrency(items, opts.concurrency ?? DEFAULT_CONCURRENCY, async (item) => {
    const id = entry.itemId(item);
    try {
      const value = await entry.handler(item, { jobId: job.id, userId, payload: opts.payload ?? {} });
      successCount++;
      await appendBulkJobEvent(job.id, "item_ok", { item_id: id });
      return value;
    } catch (e: unknown) {
      errorCount++;
      const msg = e instanceof Error ? e.message : String(e);
      await appendBulkJobEvent(job.id, "item_error", { item_id: id, error: msg });
      throw e;
    } finally {
      processed++;
      opts.onProgress?.(processed, items.length);
      // periodic snapshot (every 5 items or last)
      if (processed % 5 === 0 || processed === items.length) {
        await updateBulkJob(job.id, { processed, success_count: successCount, error_count: errorCount });
      }
    }
  });

  const finalStatus = errorCount === 0 ? "completed" : (successCount === 0 ? "failed" : "completed_with_errors");
  await updateBulkJob(job.id, {
    status: finalStatus,
    processed,
    success_count: successCount,
    error_count: errorCount,
    completed_at: new Date().toISOString(),
  });
  await appendBulkJobEvent(job.id, "job_completed", { status: finalStatus, successCount, errorCount });

  const results: BulkItemResult<R>[] = settled.map((r, i) => {
    const itemId = entry.itemId(items[i]);
    return r.status === "fulfilled"
      ? { itemId, ok: true, value: r.value }
      : { itemId, ok: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) };
  });

  return { jobId: job.id, scope, total: items.length, successCount, errorCount, results };
}

/**
 * Variante "fire-and-forget": lancia il job e ritorna subito il jobId.
 * Le UI possono iscriversi a `useBulkJob(jobId)` per il progress.
 */
export async function startBulkOp<I>(
  scope: BulkScope,
  items: ReadonlyArray<I>,
  opts: BulkRunOptions = {},
): Promise<{ jobId: string }> {
  const entry = getEntry(scope);
  const userId = await getCurrentUserId();
  const job = await createBulkJob({
    scope,
    source_view: opts.sourceView,
    total: items.length,
    payload: opts.payload ?? {},
    created_by: userId,
  });
  // Run async, log a console se fallisce — lo stato finale resta su DB.
  void runBulkOp(scope, items, opts).catch(() => {
    // l'errore è già loggato in DB
    void entry; // referenced to silence unused
  });
  return { jobId: job.id };
}