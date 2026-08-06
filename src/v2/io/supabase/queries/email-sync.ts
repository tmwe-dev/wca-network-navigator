/**
 * IO Queries: Email Sync Jobs
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

export type EmailSyncJobRow = Database["public"]["Tables"]["email_sync_jobs"]["Row"];

export async function fetchEmailSyncJobsRaw(limit: number): Promise<{
  data: EmailSyncJobRow[] | null;
  error: PostgrestError | null;
}> {
  return supabase.from("email_sync_jobs").select("*").order("created_at", { ascending: false }).limit(limit);
}
