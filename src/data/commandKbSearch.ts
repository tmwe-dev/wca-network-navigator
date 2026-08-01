/**
 * DAL — full-text search kb_entries per il tool "search-kb" della Command page.
 */
import { supabase } from "@/integrations/supabase/client";

export interface KbSearchRow {
  id: string;
  title: string;
  category: string;
  content: string;
  source_path: string | null;
  priority: number;
}

export async function searchKbFullText(cleaned: string): Promise<KbSearchRow[]> {
  const { data, error } = await supabase
    .from("kb_entries")
    .select("id, title, category, content, source_path, priority")
    .textSearch("content", cleaned, { type: "websearch", config: "italian" })
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function searchKbByTitle(term: string): Promise<KbSearchRow[]> {
  const { data } = await supabase
    .from("kb_entries")
    .select("id, title, category, content, source_path, priority")
    .ilike("title", `%${term}%`)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(20);
  return data ?? [];
}
