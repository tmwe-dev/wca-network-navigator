/**
 * DAL — kb_entries
 * Centralizes all KB entry queries and mutations.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

type KbInsert = Database["public"]["Tables"]["kb_entries"]["Insert"];

export interface KbEntry {
  id: string;
  user_id: string;
  category: string;
  chapter: string;
  title: string;
  content: string;
  tags: string[];
  priority: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = queryKeys.v2.kbEntries();

// ── Reads ──

export async function findKbEntries(): Promise<KbEntry[]> {
  const { data, error } = await supabase
    .from("kb_entries")
    .select("*")
    .order("category")
    .order("sort_order");
  if (error) throw error;
  return (data || []) as KbEntry[];
}

export async function countKbEntries(): Promise<number> {
  const { count, error } = await supabase
    .from("kb_entries")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
}

// ── Writes ──

export async function upsertKbEntry(entry: Partial<KbEntry> & { title: string; content: string }, userId: string): Promise<void> {
  const payload = { ...entry, user_id: userId };
  if (entry.id) {
    const { error } = await supabase.from("kb_entries").update(payload).eq("id", entry.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("kb_entries").insert(payload as KbInsert);
    if (error) throw error;
  }
}

export async function deleteKbEntry(id: string): Promise<void> {
  const { error } = await supabase.from("kb_entries").delete().eq("id", id);
  if (error) throw error;
}

export async function bulkInsertKbEntries(entries: KbInsert[]): Promise<number> {
  for (let i = 0; i < entries.length; i += 10) {
    const batch = entries.slice(i, i + 10);
    const { error } = await supabase.from("kb_entries").insert(batch);
    if (error) throw error;
  }
  return entries.length;
}

// ── Cache ──

export function invalidateKbEntries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: QUERY_KEY });
}

/** Risolve un riferimento KB entry (UUID esatto o titolo fuzzy, solo non-deleted) → {id, title}. */
export async function findKbEntryRef(ref: string, byId: boolean): Promise<{ id: string; title: string } | null> {
  if (byId) {
    const { data } = await supabase.from("kb_entries").select("id, title").eq("id", ref).maybeSingle();
    return data ? { id: data.id as string, title: (data.title ?? "") as string } : null;
  }
  const { data } = await supabase
    .from("kb_entries")
    .select("id, title")
    .ilike("title", `%${ref}%`)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id as string, title: (data.title ?? "") as string } : null;
}

/** Update arbitrario di una KB entry per id (usato dai tool Command). */
export async function updateKbEntryFields(id: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("kb_entries").update(updates as never).eq("id", id);
  if (error) throw error;
}

/** Soft-delete di una KB entry (deleted_at + is_active=false). */
export async function softDeleteKbEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("kb_entries")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id);
  if (error) throw error;
}
