/**
 * DAL — kb_entries (Email Forge Lab)
 */
import { supabase } from "@/integrations/supabase/client";

export interface ForgeKbEntryRow {
  id: string;
  title: string;
  content: string;
  category: string;
  chapter: string | null;
  priority: number;
  is_active: boolean;
  tags: string[] | null;
  updated_at: string;
}

const FORGE_KB_SELECT = "id,title,content,category,chapter,priority,is_active,tags,updated_at";

export async function findForgeKbEntries(categories: string[] | null): Promise<ForgeKbEntryRow[]> {
  let q = supabase
    .from("kb_entries")
    .select(FORGE_KB_SELECT)
    .order("priority", { ascending: false })
    .order("title", { ascending: true })
    .limit(200);
  if (categories && categories.length > 0) q = q.in("category", categories);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ForgeKbEntryRow[];
}

export async function updateForgeKbEntry(
  id: string,
  patch: Partial<Pick<ForgeKbEntryRow, "title" | "content" | "priority" | "is_active">>,
): Promise<void> {
  const { error } = await supabase.from("kb_entries").update(patch).eq("id", id);
  if (error) throw error;
}

export async function insertForgeKbEntry(input: {
  title: string;
  content: string;
  category: string;
  priority?: number;
  user_id: string | null;
}): Promise<ForgeKbEntryRow> {
  const { data, error } = await supabase
    .from("kb_entries")
    .insert({
      title: input.title,
      content: input.content,
      category: input.category,
      priority: input.priority ?? 5,
      is_active: true,
      user_id: input.user_id,
    })
    .select(FORGE_KB_SELECT)
    .single();
  if (error) throw error;
  return data as ForgeKbEntryRow;
}
