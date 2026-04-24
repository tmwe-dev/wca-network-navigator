/**
 * DAL — harmonizer_followups
 *
 * Registra le proposte dell'Harmonizer che NON sono eseguibili automaticamente
 * (resolution_layer in 'contract' | 'code_policy') come task per lo sviluppatore.
 * Senza questa tabella, le proposte read-only sparivano nei log.
 */
import { supabase } from "@/integrations/supabase/client";
import type { HarmonizeProposal, MissingContract } from "./harmonizeRuns";

export interface HarmonizerFollowupInsert {
  run_id: string;
  proposal_id: string;
  layer: "contract" | "code_policy";
  title: string;
  description: string;
  block_name?: string | null;
  missing_contracts?: MissingContract[];
  code_policy_needed?: string | null;
  severity?: "low" | "medium" | "high" | "critical";
  impact_score?: number;
  evidence?: Array<{ source: string; excerpt: string; location?: string }>;
  created_by: string;
}

export async function createHarmonizerFollowup(input: HarmonizerFollowupInsert): Promise<string> {
  const row = {
    run_id: input.run_id,
    proposal_id: input.proposal_id,
    layer: input.layer,
    title: input.title.slice(0, 500),
    description: input.description,
    block_name: input.block_name ?? null,
    missing_contracts: input.missing_contracts ?? [],
    code_policy_needed: input.code_policy_needed ?? null,
    severity: input.severity ?? "medium",
    impact_score: input.impact_score ?? 5,
    evidence: input.evidence ?? [],
    created_by: input.created_by,
  };
  const { data, error } = await supabase
    .from("harmonizer_followups")
    .insert([row] as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Helper: mappa una proposal read-only in followup. */
export function followupFromProposal(
  runId: string,
  userId: string,
  p: HarmonizeProposal,
): HarmonizerFollowupInsert | null {
  if (p.resolution_layer !== "contract" && p.resolution_layer !== "code_policy") return null;
  return {
    run_id: runId,
    proposal_id: p.id,
    layer: p.resolution_layer,
    title: p.block_label ?? p.reasoning.slice(0, 120),
    description: p.reasoning,
    block_name: p.block_label ?? null,
    missing_contracts: p.missing_contracts ?? [],
    code_policy_needed:
      p.resolution_layer === "code_policy" ? (p.payload?.code_policy_needed as string) ?? null : null,
    severity: p.severity ?? (p.impact === "high" ? "high" : p.impact === "low" ? "low" : "medium"),
    impact_score: p.impact_score ?? (p.impact === "high" ? 8 : p.impact === "low" ? 3 : 5),
    evidence: [
      {
        source: p.evidence.source,
        excerpt: p.evidence.excerpt,
        location: p.evidence.location,
      },
    ],
    created_by: userId,
  };
}