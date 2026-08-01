/**
 * DAL — conteggi per Settings → AI (kb_entries, ai_memory).
 * Estratto dai bypass DAL diretti di `AISettingsTab`: stessa query,
 * stessa semantica di errore (throw).
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchKbEntriesCount(): Promise<number> {
  const { count, error } = await supabase.from("kb_entries").select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function fetchAiMemoryCount(): Promise<number> {
  const { count, error } = await supabase.from("ai_memory").select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
