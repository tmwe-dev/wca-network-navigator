/**
 * DAL — Queries for useImportLogQueries.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ImportLogsRow = Database["public"]["Tables"]["import_logs"]["Row"];
type ImportedContactsRow = Database["public"]["Tables"]["imported_contacts"]["Row"];
type ImportErrorsRow = Database["public"]["Tables"]["import_errors"]["Row"];

export async function getAllImportLogs(): Promise<ImportLogsRow[]> {
  const { data, error } = await supabase.from("import_logs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImportLogsRow[];
}

export async function getImportLogById(id: string): Promise<ImportLogsRow> {
  const { data, error } = await supabase.from("import_logs").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ImportLogsRow;
}

export async function getAllImportedContactsForLog(importLogId: string): Promise<ImportedContactsRow[]> {
  const PAGE_SIZE = 1000;
  let allData: ImportedContactsRow[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("imported_contacts")
      .select("*")
      .eq("import_log_id", importLogId)
      .order("row_number", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    allData = allData.concat(data ?? []);
    hasMore = (data?.length || 0) === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return allData;
}

export async function getImportErrorsForLog(importLogId: string): Promise<ImportErrorsRow[]> {
  const { data, error } = await supabase
    .from("import_errors")
    .select("*")
    .eq("import_log_id", importLogId)
    .order("row_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ImportErrorsRow[];
}
