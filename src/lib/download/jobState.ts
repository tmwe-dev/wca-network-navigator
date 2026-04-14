import {
  claimDownloadJob, updateDownloadJob, getJobItemById, updateJobItem,
  updateJobItemsByJobIdAndStatus, getJobItemsByJobId, insertJobEvent, findRunningJobs,
} from "@/data/downloadJobs";

/** Claim a job: set status to running + emit event.
 * 🤖 V8: accepts "pending", "paused", AND "running" (for orphan re-attach after recovery)
 */
export async function claimJob(jobId: string): Promise<boolean> {
  const claimed = await claimDownloadJob(jobId);
  if (claimed) {
    // Fix any items stuck in "processing" from a previous interrupted run
    await updateJobItemsByJobIdAndStatus(jobId, "processing", { status: "pending" });
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
  const current = await getJobItemById(itemId, "attempt_count");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newAttempt = (((current as any)?.attempt_count) || 0) + 1;

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

  await updateJobItem(itemId, payload);
}

/** Mark item as processing. */
export async function markProcessing(itemId: string): Promise<void> {
  await updateJobItem(itemId, {
    status: "processing",
    started_at: new Date().toISOString(),
  });
}

/** Snapshot aggregate progress from items → job. */
export async function snapshotProgress(jobId: string, lastWcaId?: number, lastCompany?: string | null): Promise<void> {
  const items = await getJobItemsByJobId(jobId, "status, contacts_found, contacts_missing");
  if (!items.length) return;

  const finalized = items.filter(i => !["pending", "processing"].includes(i.status));
  const contactsFound = items.reduce((s, i) => s + (i.contacts_found || 0), 0);
  const contactsMissing = items.reduce((s, i) => s + (i.contacts_missing || 0), 0);

  const payload: Record<string, any> = {
    current_index: finalized.length,
    contacts_found_count: contactsFound,
    contacts_missing_count: contactsMissing,
  };
  if (lastWcaId) payload.last_processed_wca_id = lastWcaId;
  if (lastCompany) payload.last_processed_company = lastCompany;

  await updateDownloadJob(jobId, payload);
}

/** Finalize job: compute final status from items. */
export async function finalizeJob(jobId: string): Promise<void> {
  const items = await getJobItemsByJobId(jobId, "status");
  if (!items.length) return;

  const hasErrors = items.some(i => ["temporary_error", "permanent_error", "page_not_loaded"].includes(i.status));
  const allDone = items.every(i => !["pending", "processing"].includes(i.status));

  if (!allDone) return;

  const finalStatus = hasErrors ? "completed_with_errors" : "completed";
  const failedIds = items.filter(i => ["temporary_error", "permanent_error", "page_not_loaded"].includes(i.status));

  await updateDownloadJob(jobId, {
    status: finalStatus,
    completed_at: new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase JSON column type mismatch
    failed_ids: [] as any,
  });

  await emitEvent(jobId, null, "job_completed", { status: finalStatus, errors: failedIds.length });
}

/** Pause job with reason. */
export async function pauseJob(jobId: string, reason: string): Promise<void> {
  await updateDownloadJob(jobId, {
    status: "paused",
    error_message: reason,
  });
  await emitEvent(jobId, null, "job_paused", { reason });
}

/** Stop job: cancel all pending items. */
export async function stopJob(jobId: string): Promise<void> {
  await updateDownloadJob(jobId, { status: "stopped" });
  await updateJobItemsByJobIdAndStatus(jobId, "pending", { status: "cancelled" });
  await emitEvent(jobId, null, "job_stopped", {});
}

/**
 * Recover orphan jobs: reset stale "running" jobs to "stopped" and fix stuck items.
 */
export async function recoverOrphanJobs(): Promise<string[]> {
  const recovered: string[] = [];
  const runningJobs = await findRunningJobs();

  if (runningJobs.length > 0) {
    for (const job of runningJobs) {
      await updateDownloadJob(job.id, { status: "stopped", error_message: "Interrotto — job orfano (pagina ricaricata)" });
      await updateJobItemsByJobIdAndStatus(job.id, "processing", { status: "pending" });
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
  await insertJobEvent({
    job_id: jobId,
    item_id: itemId || undefined,
    event_type: eventType,
    payload,
  });
}
