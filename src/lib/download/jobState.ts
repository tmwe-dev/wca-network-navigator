import { supabase } from "@/integrations/supabase/client";

/** Claim a job: set status to running + emit event.
 * 🤖 V8: accepts "pending", "paused", AND "running" (for orphan re-attach after recovery)
 */
export async function claimJob(jobId: string): Promise<boolean> {
  const { data } = await supabase
    .from("download_jobs")
    .update({ status: "running", error_message: null })
    .eq("id", jobId)
    .in("status", ["pending", "paused", "running"])
    .select("id");
  if (data?.length) {
    // Fix any items stuck in "processing" from a previous interrupted run
    await supabase
      .from("download_job_items")
      .update({ status: "pending" })
      .eq("job_id", jobId)
      .eq("status", "processing");
    await emitEvent(jobId, null, "job_started", { engine: "claude-v8" });
    return true;
  }
  return false;
}

/** Update a single item's status and metadata. */
export async function updateItem(
  itemId: string,
  status: string,
  extra?: { errorCode?: string; errorMessage?: string; contactsFound?: number; contactsMissing?: number },
): Promise<void> {
  // Fetch current attempt_count and update atomically in one read + one write
  const { data: current } = await supabase.from("download_job_items").select("attempt_count").eq("id", itemId).single();
  const newAttempt = ((current?.attempt_count) || 0) + 1;

  const payload: Record<string, any> = {
    status,
    attempt_count: newAttempt,
  };

  // Set completed_at for terminal states
  if (["success", "member_not_found", "permanent_error"].includes(status)) {
    payload.completed_at = new Date().toISOString();
  }

  if (extra?.errorCode) payload.last_error_code = extra.errorCode;
  if (extra?.errorMessage) payload.last_error_message = extra.errorMessage;
  if (extra?.contactsFound !== undefined) payload.contacts_found = extra.contactsFound;
  if (extra?.contactsMissing !== undefined) payload.contacts_missing = extra.contactsMissing;

  await supabase.from("download_job_items").update(payload).eq("id", itemId);
}

/** Mark item as processing. */
export async function markProcessing(itemId: string): Promise<void> {
  await supabase.from("download_job_items").update({
    status: "processing",
    started_at: new Date().toISOString(),
  }).eq("id", itemId);
}

/** Snapshot aggregate progress from items → job. */
export async function snapshotProgress(jobId: string, lastWcaId?: number, lastCompany?: string | null): Promise<void> {
  const { data: items } = await supabase
    .from("download_job_items")
    .select("status, contacts_found, contacts_missing")
    .eq("job_id", jobId);

  if (!items) return;

  const finalized = items.filter(i => !["pending", "processing"].includes(i.status));
  const contactsFound = items.reduce((s, i) => s + (i.contacts_found || 0), 0);
  const contactsMissing = items.reduce((s, i) => s + (i.contacts_missing || 0), 0);
  const processedIds = finalized.length; // count, not actual IDs

  const payload: Record<string, any> = {
    current_index: finalized.length,
    contacts_found_count: contactsFound,
    contacts_missing_count: contactsMissing,
  };
  if (lastWcaId) payload.last_processed_wca_id = lastWcaId;
  if (lastCompany) payload.last_processed_company = lastCompany;

  await supabase.from("download_jobs").update(payload).eq("id", jobId);
}

/** Finalize job: compute final status from items. */
export async function finalizeJob(jobId: string): Promise<void> {
  const { data: items } = await supabase
    .from("download_job_items")
    .select("status")
    .eq("job_id", jobId);

  if (!items) return;

  const hasErrors = items.some(i => ["temporary_error", "permanent_error", "page_not_loaded"].includes(i.status));
  const allDone = items.every(i => !["pending", "processing"].includes(i.status));

  if (!allDone) return;

  const finalStatus = hasErrors ? "completed_with_errors" : "completed";
  const failedIds = items.filter(i => ["temporary_error", "permanent_error", "page_not_loaded"].includes(i.status));

  await supabase.from("download_jobs").update({
    status: finalStatus,
    completed_at: new Date().toISOString(),
    failed_ids: [] as any, // legacy compat
  }).eq("id", jobId);

  await emitEvent(jobId, null, "job_completed", { status: finalStatus, errors: failedIds.length });
}

/** Pause job with reason. */
export async function pauseJob(jobId: string, reason: string): Promise<void> {
  await supabase.from("download_jobs").update({
    status: "paused",
    error_message: reason,
  }).eq("id", jobId);
  await emitEvent(jobId, null, "job_paused", { reason });
}

/** Stop job: cancel all pending items. */
export async function stopJob(jobId: string): Promise<void> {
  await supabase.from("download_jobs").update({ status: "stopped" }).eq("id", jobId);
  await supabase.from("download_job_items").update({ status: "cancelled" }).eq("job_id", jobId).eq("status", "pending");
  await emitEvent(jobId, null, "job_stopped", {});
}

/**
 * Recover orphan jobs: reset stale "running" jobs to "pending" and fix stuck items.
 * 🤖 Claude Engine V8 — Diario di bordo #5
 * Called at page mount to clean up jobs that were interrupted by page reload.
 */
export async function recoverOrphanJobs(): Promise<string[]> {
  const recovered: string[] = [];

  // 1. Find jobs stuck in "running" — they have no active worker
  const { data: runningJobs } = await supabase
    .from("download_jobs")
    .select("id, country_name, current_index, updated_at")
    .eq("status", "running");

  if (runningJobs && runningJobs.length > 0) {
    for (const job of runningJobs) {
      // Reset to pending so the engine can re-claim them
      await supabase
        .from("download_jobs")
        .update({ status: "pending", error_message: "Recuperato automaticamente (job orfano)" })
        .eq("id", job.id);

      // Fix items stuck in "processing" → back to "pending"
      await supabase
        .from("download_job_items")
        .update({ status: "pending" })
        .eq("job_id", job.id)
        .eq("status", "processing");

      recovered.push(job.id);
      await emitEvent(job.id, null, "job_recovered", {
        reason: "orphan_detection",
        previousIndex: job.current_index,
      });
    }
  }

  return recovered;
}

/** Emit an event to the append-only log. */
export async function emitEvent(
  jobId: string, itemId: string | null, eventType: string, payload: Record<string, any>,
): Promise<void> {
  await supabase.from("download_job_events").insert({
    job_id: jobId,
    item_id: itemId || undefined,
    event_type: eventType,
    payload: payload as any,
  });
}
