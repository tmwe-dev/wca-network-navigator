/**
 * DAL — ai_memory (entry point unico per la memoria AI).
 *
 * Le operazioni avanzate (dashboard memoria, feedback, promozione L3) vivono
 * in `aiMemoryOps.ts` e sono ri-esportate qui per avere un solo import.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MemoryInsert = Database["public"]["Tables"]["ai_memory"]["Insert"];

export {
  findUserMemories,
  promoteMemoryToL3,
  rejectMemoryPromotion,
  findRecentMemoriesForFeedback,
  updateMemoryConfidence,
} from "./aiMemoryOps";

export async function createMemory(entry: MemoryInsert) {
  const { error } = await supabase.from("ai_memory").insert(entry);
  if (error) throw error;
}

export async function deleteMemory(id: string) {
  const { error } = await supabase.from("ai_memory").delete().eq("id", id);
  if (error) throw error;
}

/** Elenco memory_type per utente (per il conteggio episodiche/semantiche in Settings). */
export async function findMemoryTypesByUser(userId: string): Promise<{ memory_type: string }[]> {
  const { data } = await supabase
    .from("ai_memory")
    .select("memory_type")
    .eq("user_id", userId);
  return data ?? [];
}

/** Cancella tutte le memorie episodiche di un utente. */
export async function deleteEpisodicMemoriesForUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from("ai_memory")
    .delete()
    .eq("user_id", userId)
    .eq("memory_type", "episodic");
  if (error) throw error;
}
