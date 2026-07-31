/**
 * DAL — elenco email_sync_jobs (senza filtro status).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EmailSyncJobRow = Database["public"]["Tables"]["email_sync_jobs"]["Row"];

export async function findEmailSyncJobsList(limit = 20): Promise<EmailSyncJobRow[]> {
  const { data, error } = await supabase
    .from("email_sync_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
