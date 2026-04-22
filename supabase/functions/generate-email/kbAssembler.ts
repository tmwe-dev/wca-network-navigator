/**
 * kbAssembler.ts — Knowledge base loading and strategic category selection.
 *
 * Handles fetching KB entries with quality-based limits and always-on categories.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Quality } from "../_shared/kbSlice.ts";

type SupabaseClient = ReturnType<typeof createClient>;

interface KbEntry {
  title: string;
  content: string;
  category: string;
  chapter: string;
  tags: string[];
}

/**
 * Always-on KB categories. Loaded from `system_doctrine` table when available
 * (rows with category in this prefix list), with safe fallback to the codebase
 * defaults if the table is empty / unreachable.
 *
 * Fix 5 (Gap E): rimuove l'hardcoding diretto delle 6 categorie always-on.
 */
const FALLBACK_ALWAYS_ON_CATEGORIES = [
  "regole_sistema",
  "filosofia",
  "struttura_email",
  "hook",
  "cold_outreach",
  "dati_partner",
] as const;

async function loadAlwaysOnCategories(supabase: SupabaseClient): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("system_doctrine")
      .select("category")
      .eq("is_active", true)
      .eq("always_on", true)
      .limit(50);
    const cats = (data ?? [])
      .map((r: { category: string | null }) => r.category)
      .filter((c): c is string => !!c);
    if (cats.length) return [...new Set(cats)];
  } catch {
    // Table may not exist or be readable — fall back silently
  }
  return [...FALLBACK_ALWAYS_ON_CATEGORIES];
}

export async function fetchKbEntriesStrategic(
  supabase: SupabaseClient,
  quality: Quality,
  userId: string,
  context: {
    emailCategory?: string;
    hasInteractionHistory?: boolean;
    isFollowUp?: boolean;
    kb_categories?: string[];
  },
): Promise<{ text: string; sections_used: string[] }> {
  const limit = quality === "fast" ? 8 : quality === "standard" ? 18 : 40;
  const alwaysOn = await loadAlwaysOnCategories(supabase);
  const categories: string[] = [...alwaysOn];
  if (context.kb_categories?.length) categories.push(...context.kb_categories);
  if (context.isFollowUp) categories.push("followup", "chris_voss", "obiezioni");
  if (quality !== "fast") categories.push("negoziazione", "tono", "frasi_modello");
  if (quality === "premium") categories.push("arsenale", "persuasione", "chiusura", "errori");

  const { data: entries } = await supabase
    .from("kb_entries")
    .select("title, content, category, chapter, tags")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("category", [...new Set(categories)])
    .order("priority", { ascending: false })
    .order("sort_order")
    .limit(limit);

  if (!entries || entries.length === 0) return { text: "", sections_used: [] };
  const sectionsUsed = [...new Set((entries as KbEntry[]).map((e) => e.category))];
  const text = (entries as KbEntry[])
    .map((e) => `### ${e.title} [${e.chapter}]\n${e.content}`)
    .join("\n\n---\n\n");
  return { text, sections_used: sectionsUsed };
}
