/**
 * DAL — kb_entry_proposals
 * Proposte di nuovo materiale per la KB. La chat copilota propone, l'umano approva.
 * Solo dopo approvazione il record viene materializzato in kb_entries.
 */
import { supabase } from "@/integrations/supabase/client";

export interface KbEntryProposal {
  id: string;
  source: "paste" | "url" | "file" | "chat";
  raw_content: string;
  source_url: string | null;
  suggested_category: string | null;
  suggested_chapter: string | null;
  suggested_title: string | null;
  suggested_content: string | null;
  suggested_tags: string[];
  suggested_priority: number | null;
  conflicts_with: string[];
  duplicates_of: string | null;
  ai_rationale: string | null;
  status: "pending" | "approved" | "rejected";
  approved_kb_entry_id: string | null;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateKbEntryProposalInput {
  source: KbEntryProposal["source"];
  raw_content: string;
  source_url?: string | null;
  suggested_category?: string | null;
  suggested_chapter?: string | null;
  suggested_title?: string | null;
  suggested_content?: string | null;
  suggested_tags?: string[];
  suggested_priority?: number;
  conflicts_with?: string[];
  duplicates_of?: string | null;
  ai_rationale?: string | null;
}

export async function listKbEntryProposals(opts: { status?: string } = {}): Promise<KbEntryProposal[]> {
  let q = supabase
    .from("kb_entry_proposals")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as unknown as KbEntryProposal[];
}

export async function createKbEntryProposal(input: CreateKbEntryProposalInput): Promise<KbEntryProposal> {
  const { data, error } = await supabase
    .from("kb_entry_proposals")
    .insert({
      source: input.source,
      raw_content: input.raw_content,
      source_url: input.source_url ?? null,
      suggested_category: input.suggested_category ?? null,
      suggested_chapter: input.suggested_chapter ?? null,
      suggested_title: input.suggested_title ?? null,
      suggested_content: input.suggested_content ?? null,
      suggested_tags: input.suggested_tags ?? [],
      suggested_priority: input.suggested_priority ?? 50,
      conflicts_with: input.conflicts_with ?? [],
      duplicates_of: input.duplicates_of ?? null,
      ai_rationale: input.ai_rationale ?? null,
    } as never)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as unknown as KbEntryProposal;
}

export async function reviewKbEntryProposal(
  id: string,
  status: "approved" | "rejected",
  note?: string,
  approvedKbEntryId?: string,
): Promise<void> {
  const { error } = await supabase
    .from("kb_entry_proposals")
    .update({
      status,
      review_note: note ?? null,
      approved_kb_entry_id: approvedKbEntryId ?? null,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
  if (error) throw error;
}