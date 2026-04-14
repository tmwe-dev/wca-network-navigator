/**
 * DAL — ai_memory
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MemoryInsert = Database["public"]["Tables"]["ai_memory"]["Insert"];

export async function createMemory(entry: MemoryInsert) {
  const { error } = await supabase.from("ai_memory").insert(entry);
  if (error) throw error;
}

export async function deleteMemory(id: string) {
  const { error } = await supabase.from("ai_memory").delete().eq("id", id);
  if (error) throw error;
}
