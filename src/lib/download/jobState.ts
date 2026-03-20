import { supabase } from "@/integrations/supabase/client";

/** Update download job progress in the database. */
export async function updateJob(
  jobId: string,
  payload: Record<string, any>,
): Promise<void> {
  if (Object.keys(payload).length > 0) {
    await supabase.from("download_jobs").update(payload).eq("id", jobId);
  }
}

/** Mark job as completed. */
export async function completeJob(jobId: string, failedIds: number[]): Promise<void> {
  await supabase.from("download_jobs").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    failed_ids: failedIds as any,
  }).eq("id", jobId);
}

/** Mark job as paused with a reason. */
export async function pauseJob(jobId: string, reason: string): Promise<void> {
  await supabase.from("download_jobs").update({
    status: "paused",
    error_message: reason,
  }).eq("id", jobId);
}
