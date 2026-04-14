/**
 * DAL — import_logs
 */
import { supabase } from "@/integrations/supabase/client";

export async function createImportLog(log: Record<string, unknown>) {
  const { data, error } = await supabase.from("import_logs").insert(log as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateImportLog(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("import_logs").update(updates).eq("id", id);
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
