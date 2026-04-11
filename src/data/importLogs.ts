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
