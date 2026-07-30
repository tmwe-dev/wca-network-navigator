/**
 * DAL — app_error_logs.
 * Estratto dal bypass DAL diretto di `src/lib/errorCatchers.ts`.
 * Semantica invariata: insert best-effort, errore non propagato dal caller.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AppErrorLogEntry {
  readonly user_id: string;
  readonly error_type: string;
  readonly error_message: string;
  readonly error_stack: string | null;
  readonly page_url: string;
  readonly user_agent: string;
}

export async function insertAppErrorLog(entry: AppErrorLogEntry): Promise<void> {
  await supabase.from("app_error_logs").insert(entry);
}
