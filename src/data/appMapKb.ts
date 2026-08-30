/**
 * DAL — voce KB della Mappa Applicazione.
 * canonical_id: `data-schema/app-map` (unico, upsert idempotente).
 */
import { supabase } from "@/integrations/supabase/client";

export const APP_MAP_CANONICAL_ID = "data-schema/app-map";
export const APP_MAP_TITLE = "Mappa Applicazione (pagine, campi, funzioni)";

export async function upsertAppMapKbEntry(content: string): Promise<"created" | "updated"> {
  const { data: existing, error: findErr } = await supabase
    .from("kb_entries")
    .select("id")
    .eq("canonical_id", APP_MAP_CANONICAL_ID)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing?.id) {
    const { error } = await supabase
      .from("kb_entries")
      .update({ content, title: APP_MAP_TITLE, is_active: true, last_reviewed_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return "updated";
  }

  const { data: userRes } = await supabase.auth.getSession();
  const { error } = await supabase.from("kb_entries").insert({
    canonical_id: APP_MAP_CANONICAL_ID,
    title: APP_MAP_TITLE,
    content,
    category: "data-schema",
    family: "data-schema",
    chapter: "navigation",
    priority: 90,
    is_active: true,
    tags: ["mappa", "navigazione", "pagine", "routing", "campi"],
    user_id: userRes.session?.user.id ?? null,
  });
  if (error) throw error;
  return "created";
}
