/**
 * DAL — prompt_change_proposals
 * Proposte di modifica prompt generate dalla chat copilota del Prompt Reader.
 * Nessuna scrittura diretta su operative_prompts: solo proposte da revisionare.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PromptChangeProposal {
  id: string;
  prompt_id: string;
  prompt_table: string;
  block_name: string;
  source_tool: string;
  status: "pending" | "approved" | "rejected" | "applied";
  current_content: string | null;
  proposed_content: string;
  diff_text: string | null;
  rationale: string | null;
  risks: string | null;
  assumptions: string | null;
  kb_entries_consulted: string[];
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreatePromptChangeProposalInput {
  prompt_id: string;
  prompt_table?: string;
  block_name: string;
  source_tool?: string;
  current_content?: string | null;
  proposed_content: string;
  diff_text?: string | null;
  rationale?: string | null;
  risks?: string | null;
  assumptions?: string | null;
  kb_entries_consulted?: string[];
}

export async function listPromptChangeProposals(opts: { status?: string } = {}): Promise<PromptChangeProposal[]> {
  let q = supabase
    .from("prompt_change_proposals")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as unknown as PromptChangeProposal[];
}

export async function createPromptChangeProposal(input: CreatePromptChangeProposalInput): Promise<PromptChangeProposal> {
  const { data, error } = await supabase
    .from("prompt_change_proposals")
    .insert({
      prompt_id: input.prompt_id,
      prompt_table: input.prompt_table ?? "operative_prompts",
      block_name: input.block_name,
      source_tool: input.source_tool ?? "prompt-reader-copilot",
      current_content: input.current_content ?? null,
      proposed_content: input.proposed_content,
      diff_text: input.diff_text ?? null,
      rationale: input.rationale ?? null,
      risks: input.risks ?? null,
      assumptions: input.assumptions ?? null,
      kb_entries_consulted: input.kb_entries_consulted ?? [],
    } as never)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as unknown as PromptChangeProposal;
}

export async function reviewPromptChangeProposal(
  id: string,
  status: "approved" | "rejected",
  note?: string,
): Promise<void> {
  const { error } = await supabase
    .from("prompt_change_proposals")
    .update({
      status,
      review_note: note ?? null,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
  if (error) throw error;
}