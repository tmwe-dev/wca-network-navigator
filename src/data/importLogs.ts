/**
 * DAL — import_logs
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ImportLogInsert = Database["public"]["Tables"]["import_logs"]["Insert"];

export async function createImportLog(log: ImportLogInsert) {
  const { data, error } = await supabase.from("import_logs").insert(log).select().single();
  if (error) throw error;
  return data;
}

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
