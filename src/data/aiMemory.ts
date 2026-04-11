/**
 * DAL — ai_memory
 */
import { supabase } from "@/integrations/supabase/client";

export async function createMemory(entry: { user_id: string; content: string; memory_type: string; source: string; importance?: number; tags?: string[]; context_page?: string }) {
  const { error } = await supabase.from("ai_memory").insert(entry);
  if (error) throw error;
}

export async function deleteMemory(id: string) {
  const { error } = await supabase.from("ai_memory").delete().eq("id", id);
  if (error) throw error;
}
