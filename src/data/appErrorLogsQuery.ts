/**
 * DAL — app_error_logs: lettura filtrata e pulizia log (ErrorLogPanel).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppErrorLogRow = Database["public"]["Tables"]["app_error_logs"]["Row"];

/** Ultimi log errori, opzionalmente filtrati per tipo. */
export async function findAppErrorLogs(errorType: string, limit = 50): Promise<AppErrorLogRow[]> {
  let q = supabase
    .from("app_error_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (errorType !== "all") q = q.eq("error_type", errorType);
  const { data } = await q;
  return data ?? [];
}

/** Elimina log più vecchi di una data. */
export async function deleteAppErrorLogsBefore(beforeIso: string): Promise<void> {
  await supabase.from("app_error_logs").delete().lt("created_at", beforeIso);
}
