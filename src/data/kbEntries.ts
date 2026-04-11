/**
 * DAL — kb_entries
 * Centralizes all KB entry queries and mutations.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { QueryClient } from "@tanstack/react-query";

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

const QUERY_KEY = ["kb_entries"] as const;

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
