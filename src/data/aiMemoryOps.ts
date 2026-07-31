/**
 * DAL — ai_memory: operazioni aggiuntive (dashboard memoria, feedback).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MemoryUpdate = Database["public"]["Tables"]["ai_memory"]["Update"];
type MemoryRow = Database["public"]["Tables"]["ai_memory"]["Row"];

/** Tutte le memorie di un utente, ordinate per livello e confidenza decrescenti. */
export async function findUserMemories(userId: string, limit = 100): Promise<MemoryRow[]> {
  const { data, error } = await supabase
    .from("ai_memory")
    .select("*")
    .eq("user_id", userId)
    .order("level", { ascending: false })
    .order("confidence", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Promuove una memoria a L3 (permanente). */
export async function promoteMemoryToL3(id: string): Promise<void> {
  const update: MemoryUpdate = {
    level: 3,
    pending_promotion: false,
    decay_rate: 0,
    promoted_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("ai_memory").update(update).eq("id", id);
  if (error) throw error;
}

/** Rifiuta la promozione in sospeso di una memoria. */
export async function rejectMemoryPromotion(id: string): Promise<void> {
  const update: MemoryUpdate = { pending_promotion: false };
  const { error } = await supabase.from("ai_memory").update(update).eq("id", id);
  if (error) throw error;
}

/** Ultime memorie L1/L2 di un utente (per boost/reduce confidence su feedback). */
export async function findRecentMemoriesForFeedback(
  userId: string,
  limit = 5,
): Promise<Array<{ id: string; confidence: number; level: number }>> {
  const { data } = await supabase
    .from("ai_memory")
    .select("id, confidence, level")
    .eq("user_id", userId)
    .in("level", [1, 2])
    .order("last_accessed_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Aggiorna la confidenza di una memoria. */
export async function updateMemoryConfidence(id: string, confidence: number): Promise<void> {
  const update: MemoryUpdate = { confidence };
  const { error } = await supabase.from("ai_memory").update(update).eq("id", id);
  if (error) throw error;
}
