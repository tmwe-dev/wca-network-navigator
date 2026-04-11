/**
 * DAL — ai_memory
 */
import { supabase } from "@/integrations/supabase/client";

export async function createMemory(entry: Record<string, unknown>) {
  const { error } = await supabase.from("ai_memory").insert(entry as any);
  if (error) throw error;
}

export async function deleteMemory(id: string) {
  const { error } = await supabase.from("ai_memory").delete().eq("id", id);
  if (error) throw error;
}
