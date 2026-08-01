/**
 * DAL — kb_entries
 * Centralizes all KB entry queries and mutations.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type KbEntryUpdate = Database["public"]["Tables"]["kb_entries"]["Update"];
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

type KbInsert = Database["public"]["Tables"]["kb_entries"]["Insert"];
type KbUpdate = Database["public"]["Tables"]["kb_entries"]["Update"];
/** Riga grezza `kb_entries` (contratto canonico per i mapper v2). */
export type KbEntryRow = Database["public"]["Tables"]["kb_entries"]["Row"];

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

/**
 * Righe grezze `kb_entries` ordinate per priorità (contratto usato dal layer
 * IO v2, che applica i propri mapper di dominio).
 */
export async function findKbEntryRowsByPriority(): Promise<KbEntryRow[]> {
  const { data, error } = await supabase
    .from("kb_entries")
    .select("*")
    .order("priority", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Ricerca full-text semplice su titolo/contenuto, righe grezze. */
export async function searchKbEntryRows(query: string, limit = 50): Promise<KbEntryRow[]> {
  const { data, error } = await supabase
    .from("kb_entries")
    .select("*")
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .order("priority", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Insert con ritorno della riga creata (contratto usato dal layer IO v2). */
export async function insertKbEntryReturningRow(input: KbInsert): Promise<KbEntryRow> {
  const { data, error } = await supabase.from("kb_entries").insert(input).select().single();
  if (error) throw error;
  return data;
}

/** Update tipizzato di una KB entry per id. */
export async function updateKbEntryRow(id: string, updates: KbUpdate): Promise<void> {
  const { error } = await supabase.from("kb_entries").update(updates).eq("id", id);
  if (error) throw error;
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
export async function updateKbEntryFields(id: string, updates: KbEntryUpdate): Promise<void> {
  const { error } = await supabase.from("kb_entries").update(updates).eq("id", id);
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

export interface KbToolListEntry {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly tags: readonly string[] | null;
  readonly source_path: string | null;
}

/** Lista entry KB attive (opzionalmente filtrate per categoria) per il tool agente `list_kb`. */
export async function findActiveKbEntriesForTool(category?: string, limit = 50): Promise<KbToolListEntry[]> {
  let query = supabase
    .from("kb_entries")
    .select("id, title, category, tags, source_path, priority")
    .eq("is_active", true)
    .order("priority", { ascending: false });
  if (category) query = query.eq("category", category);
  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return (data ?? []) as KbToolListEntry[];
}

export interface KbToolContentEntry {
  readonly title: string;
  readonly content: string | null;
  readonly category: string;
  readonly tags: readonly string[] | null;
}

/** Legge una entry KB attiva per slug (source_path o title, fuzzy match) per il tool agente `read_kb`. */
export async function findKbEntryContentBySlug(slug: string): Promise<KbToolContentEntry | null> {
  const { data, error } = await supabase
    .from("kb_entries")
    .select("id, title, content, category, tags")
    .or(`source_path.ilike.%${slug}%,title.ilike.%${slug}%`)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as KbToolContentEntry | null;
}

export interface KbIndexRow {
  readonly title: string;
  readonly category: string;
  readonly chapter: string | null;
}

/** Indice titoli+categoria delle KB entry attive per un set di categorie (usato dal Prompt Assembler). */
export async function findKbIndexByCategories(categories: readonly string[]): Promise<KbIndexRow[]> {
  const { data } = await supabase
    .from("kb_entries")
    .select("title, category, chapter")
    .in("category", categories)
    .eq("is_active", true)
    .order("category")
    .order("priority", { ascending: false });
  return (data ?? []) as KbIndexRow[];
}

export interface KbExcerptRow {
  readonly title: string;
  readonly content: string | null;
}

/** Estratti (title+content) delle KB entry attive con titolo in `titles` (usato dal Prompt Assembler). */
export async function findKbExcerptsByTitles(titles: readonly string[]): Promise<KbExcerptRow[]> {
  const { data } = await supabase
    .from("kb_entries")
    .select("title, content")
    .in("title", titles)
    .eq("is_active", true);
  return (data ?? []) as KbExcerptRow[];
}

export interface KbContextRow {
  readonly title: string;
  readonly category: string;
  readonly content: string;
  readonly source_path: string | null;
}

/** Full-text search (italiano) sul contenuto delle KB entry attive, per contesto agente. */
export async function findKbContextByFullText(cleaned: string, limit: number): Promise<KbContextRow[]> {
  const { data } = await supabase
    .from("kb_entries")
    .select("title, category, content, source_path")
    .textSearch("content", cleaned, { type: "websearch", config: "italian" })
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(limit);
  return (data ?? []) as KbContextRow[];
}

/** Fallback fuzzy match su titolo delle KB entry attive, per contesto agente. */
export async function findKbContextByTitleFuzzy(word: string, limit: number): Promise<KbContextRow[]> {
  const { data } = await supabase
    .from("kb_entries")
    .select("title, category, content, source_path")
    .ilike("title", `%${word}%`)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(limit);
  return (data ?? []) as KbContextRow[];
}

/** Inserisce una KB entry "block" (senza user_id obbligatorio) per il flow di creazione rapida del Prompt Lab. */
export async function insertKbEntryBlock(entry: { title: string; content: string; category: string; is_active: boolean }): Promise<void> {
  const { error } = await supabase.from("kb_entries").insert(entry);
  if (error) throw error;
}

export interface InsertKbEntryForApprovalInput {
  user_id: string;
  category: string;
  chapter: string;
  title: string;
  content: string;
  tags: string[];
  priority: number;
  is_active: boolean;
}

/** Inserisce una KB entry a partire da una proposta approvata; ritorna l'id creato. */
export async function insertKbEntryForApproval(entry: InsertKbEntryForApprovalInput): Promise<string | null> {
  const { data, error } = await supabase
    .from("kb_entries")
    .insert(entry)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
