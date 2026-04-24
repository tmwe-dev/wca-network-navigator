/**
 * kbFetcher.ts — Knowledge Base retrieval for outreach context.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Quality } from "../_shared/kbSlice.ts";
import type { Channel } from "./promptBuilder.ts";

export async function fetchKbEntriesForOutreach(
  supabase: SupabaseClient, quality: Quality, channel: Channel, userId: string,
): Promise<{ text: string; sections: string[] }> {
  const limit = quality === "fast" ? 6 : quality === "standard" ? 15 : 35;
  const categories = ["regole_sistema", "filosofia"];
  if (channel === "email") categories.push("struttura_email", "hook", "cold_outreach");
  if (channel === "linkedin") categories.push("cold_outreach", "tono");
  if (channel === "whatsapp") categories.push("tono", "frasi_modello");
  if (quality !== "fast") categories.push("negoziazione", "chris_voss", "dati_partner");
  if (quality === "premium") categories.push("arsenale", "persuasione", "obiezioni", "chiusura", "followup", "errori");

  const { data: entries } = await supabase
    .from("kb_entries").select("title, content, category, chapter, tags")
    .eq("user_id", userId).eq("is_active", true).in("category", categories)
    .order("priority", { ascending: false }).order("sort_order").limit(limit);

  if (!entries?.length) return { text: "", sections: [] };
  const sections = [...new Set(entries.map((e: { category: string }) => e.category))];
  const text = entries.map((e: { title: string; content: string; chapter: string }) => `### ${e.title} [${e.chapter}]\n${e.content}`).join("\n\n---\n\n");
  return { text, sections };
}
