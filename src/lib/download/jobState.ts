import { supabase } from "@/integrations/supabase/client";

/** Claim a job: set status to running + emit event. */
export async function claimJob(jobId: string): Promise<boolean> {
  const { data } = await supabase
    .from("download_jobs")
    .update({ status: "running", error_message: null })
    .eq("id", jobId)
    .in("status", ["pending", "paused"])
    .select("id");
  if (data?.length) {
    await emitEvent(jobId, null, "job_started", {});
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
  const payload: Record<string, any> = {
    status,
    attempt_count: supabase.rpc ? undefined : undefined, // increment handled separately
    completed_at: ["success", "member_not_found", "permanent_error"].includes(status) ? new Date().toISOString() : undefined,
  };
  if (extra?.errorCode) payload.last_error_code = extra.errorCode;
  if (extra?.errorMessage) payload.last_error_message = extra.errorMessage;
  if (extra?.contactsFound !== undefined) payload.contacts_found = extra.contactsFound;
  if (extra?.contactsMissing !== undefined) payload.contacts_missing = extra.contactsMissing;

  // Clean undefined
  for (const k of Object.keys(payload)) { if (payload[k] === undefined) delete payload[k]; }

  await supabase.from("download_job_items").update(payload).eq("id", itemId);

  // Increment attempt_count
  const { data: item } = await supabase.from("download_job_items").select("attempt_count").eq("id", itemId).single();
  if (item) {
    await supabase.from("download_job_items").update({ attempt_count: (item.attempt_count || 0) + 1 }).eq("id", itemId);
  }
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
