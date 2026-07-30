/**
 * DAL — email_sync_jobs (server-side sync jobs).
 */
import { supabase } from "@/integrations/supabase/client";

export async function findActiveSyncJob<T>(): Promise<T | null> {
  const { data, error } = await supabase
    .from("email_sync_jobs")
    .select("*")
    .in("status", ["running", "paused", "error"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as T) ?? null;
}

export async function findLastCompletedSyncJob<T>(): Promise<T | null> {
  const { data, error } = await supabase
    .from("email_sync_jobs")
    .select("*")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as T) ?? null;
}

/** Chiude i job running/paused di un utente. */
export async function closeOpenSyncJobs(userId: string): Promise<void> {
  const { error } = await supabase
    .from("email_sync_jobs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("status", ["running", "paused"]);
  if (error) throw error;
}

export async function createSyncJob(userId: string) {
  const { data, error } = await supabase
    .from("email_sync_jobs")
    .insert({ user_id: userId, status: "running" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSyncJobStatus(
  jobId: string,
  patch: { status: string; error_message?: string | null; completed_at?: string },
): Promise<void> {
  const { error } = await supabase.from("email_sync_jobs").update(patch).eq("id", jobId);
  if (error) throw error;
}
