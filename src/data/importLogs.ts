/**
 * DAL — import_logs
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ImportLogInsert = Database["public"]["Tables"]["import_logs"]["Insert"];

export async function updateImportLog(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("import_logs").update(updates as never).eq("id", id);
  if (error) throw error;
}

export async function deleteImportLog(id: string) {
  const { error } = await supabase.from("import_logs").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteImportErrors(importLogId: string) {
  const { error } = await supabase.from("import_errors").delete().eq("import_log_id", importLogId);
  if (error) throw error;
}

export async function deleteImportedContactsByLogId(importLogId: string) {
  const { error } = await supabase.from("imported_contacts").delete().eq("import_log_id", importLogId);
  if (error) throw error;
}

export async function findOrCreateManualImportLog(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("import_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("file_name", "__manual_entry__")
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newLog, error } = await supabase
    .from("import_logs")
    .insert({
      user_id: userId,
      file_name: "__manual_entry__",
      total_rows: 0,
      status: "completed",
      group_name: "Inserimento Manuale",
    })
    .select("id")
    .single();
  if (error || !newLog) throw error || new Error("Failed to create import log");
  return newLog.id;
}

/** Upload del file sorgente su storage + signed URL annuale. */
export async function uploadImportFile(
  userId: string,
  file: File,
): Promise<{ path: string; signedUrl: string | null }> {
  const filePath = `${userId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from("import-files").upload(filePath, file);
  if (uploadError) throw uploadError;
  const { data: urlData } = await supabase.storage
    .from("import-files")
    .createSignedUrl(filePath, 60 * 60 * 24 * 365);
  return { path: filePath, signedUrl: urlData?.signedUrl ?? null };
}

/** Crea una riga import_logs e la restituisce. */
export async function createImportLog(row: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("import_logs")
    .insert(row as Database["public"]["Tables"]["import_logs"]["Insert"])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** URL pubblico per un file del bucket import-files. */
export function getImportFilePublicUrl(path: string): string | null {
  const { data } = supabase.storage.from("import-files").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export interface RecentImportLogRow {
  id: string;
  file_name: string;
  total_rows: number;
  imported_rows: number;
  error_rows: number;
  status: string;
  created_at: string;
}

/** Ultime N importazioni di un utente (storico in Settings). */
export async function findRecentImportLogs(userId: string, limit = 10): Promise<RecentImportLogRow[]> {
  const { data } = await supabase
    .from("import_logs")
    .select("id, file_name, total_rows, imported_rows, error_rows, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as RecentImportLogRow[];
}
