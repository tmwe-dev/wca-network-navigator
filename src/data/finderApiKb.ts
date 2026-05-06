/**
 * DAL — finder_api_kb
 * Knowledge base self-improving per Finder API.
 */
import { supabase } from "@/integrations/supabase/client";
import { tFrom } from "@/lib/typedSupabase";

export interface FinderApiKbEntry {
  id: string;
  title: string;
  body: string;
  trigger_query: string | null;
  trigger_op: string | null;
  trigger_error: string | null;
  tags: string[];
  status: "pending" | "approved" | "archived";
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export const finderApiKbKeys = {
  all: ["finder_api_kb"] as const,
  list: (status?: string) => ["finder_api_kb", "list", status ?? "all"] as const,
};

export async function listFinderApiKb(status?: "pending" | "approved" | "archived"): Promise<FinderApiKbEntry[]> {
  let q = tFrom("finder_api_kb")
    .select("id, title, body, trigger_query, trigger_op, trigger_error, tags, status, created_by, approved_by, created_at, updated_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as FinderApiKbEntry[];
}

export async function proposeFinderApiKb(payload: {
  title: string;
  body: string;
  trigger_query?: string;
  trigger_op?: string;
  trigger_error?: string;
  tags?: string[];
}): Promise<FinderApiKbEntry> {
  const { data: userRes } = await supabase.auth.getSession();
  const userId = userRes.session?.user.id ?? null;
  const { data, error } = await tFrom("finder_api_kb")
    .insert({
      title: payload.title,
      body: payload.body,
      trigger_query: payload.trigger_query ?? null,
      trigger_op: payload.trigger_op ?? null,
      trigger_error: payload.trigger_error ?? null,
      tags: payload.tags ?? [],
      status: "pending",
      created_by: userId,
    } as never)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as unknown as FinderApiKbEntry;
}

export async function approveFinderApiKb(id: string): Promise<void> {
  const { data: userRes } = await supabase.auth.getSession();
  const userId = userRes.session?.user.id ?? null;
  const { error } = await tFrom("finder_api_kb")
    .update({ status: "approved", approved_by: userId } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function archiveFinderApiKb(id: string): Promise<void> {
  const { error } = await tFrom("finder_api_kb")
    .update({ status: "archived" } as never)
    .eq("id", id);
  if (error) throw error;
}