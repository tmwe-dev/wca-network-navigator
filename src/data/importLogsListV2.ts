/**
 * DAL — elenco import_logs (storico import).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ImportLogListRow {
  readonly id: string;
  readonly file_name: string;
  readonly total_rows: number;
  readonly imported_rows: number;
  readonly error_rows: number;
  readonly status: string;
  readonly created_at: string;
}

export async function findImportLogsList(limit = 50): Promise<ImportLogListRow[]> {
  const { data, error } = await supabase
    .from("import_logs")
    .select("id, file_name, total_rows, imported_rows, error_rows, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
