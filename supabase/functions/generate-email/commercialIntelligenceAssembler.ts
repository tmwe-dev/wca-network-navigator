/**
 * commercialIntelligenceAssembler.ts — Load commercial state, relationship metrics, and branch coordination
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { PartnerData } from "./promptBuilder.ts";
import {
  getSameCompanyBranches,
  analyzeRelationshipHistory,
  buildInterlocutorTypeBlock,
  buildBranchCoordinationBlock,
  buildRelationshipAnalysisBlock,
} from "../_shared/sameLocationGuard.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

export interface CommercialIntelligence {
  historyContext: string;
  relationshipBlock: string;
  branchBlock: string;
  interlocutorBlock: string;
  commercialState?: string;
  touchCount?: number;
  daysSinceLastContact?: number;
  warmthScore?: number;
  lastChannel?: string;
  lastOutcome?: string;
}

/**
 * Guard against contacting same person at same location (same-location check).
 */
export async function checkDuplicateContact(
  supabase: SupabaseClient,
  partnerId: string,
  contactEmail: string | null,
  userId: string,
): Promise<void> {
  const {
    checkSameLocationContacts,
  } = await import("../_shared/sameLocationGuard.ts");

  const guardResult = await checkSameLocationContacts(supabase, partnerId, contactEmail, userId);
  if (!guardResult.allowed) {
    throw Object.assign(new Error(guardResult.reason), {
      code: "duplicate_branch",
      recentContact: guardResult.recentContact,
    });
  }
}

/**
 * Assemble commercial intelligence: history, relationship metrics, branch coordination.
 */
export async function assembleCommercialIntelligence(
  supabase: SupabaseClient,
  partnerId: string | undefined,
  partner: PartnerData,
  sourceType: string,
): Promise<CommercialIntelligence> {
  const defaultResult: CommercialIntelligence = {
    historyContext: "",
    relationshipBlock: "",
    branchBlock: "",
    interlocutorBlock: buildInterlocutorTypeBlock(sourceType),
  };

  if (!partnerId) return defaultResult;

  const { metrics, historyText } = await analyzeRelationshipHistory(supabase, partnerId, "");
  const historyContext = historyText ? `\n${historyText}\n` : "";

  const relationshipBlock = buildRelationshipAnalysisBlock(metrics);
  const branches = await getSameCompanyBranches(supabase, partnerId);
  const branchBlock = buildBranchCoordinationBlock(branches, partner.city);

  const m = metrics as unknown as Record<string, unknown>;
  const commercialState = (m.commercial_state as string | undefined) ?? (partner.lead_status as string | undefined);
  const touchCount =
    typeof m.total_interactions === "number"
      ? m.total_interactions
      : typeof m.touch_count === "number"
        ? m.touch_count
        : undefined;
  const daysSinceLastContact =
    typeof m.days_since_last_contact === "number" ? m.days_since_last_contact : undefined;
  const warmthScore = typeof m.warmth_score === "number" ? m.warmth_score : undefined;
  const lastChannel = m.last_channel as string | undefined;
  const lastOutcome = m.last_outcome as string | undefined;
  const interlocutorBlock = buildInterlocutorTypeBlock(sourceType);

  return {
    historyContext,
    relationshipBlock,
    branchBlock,
    interlocutorBlock,
    commercialState,
    touchCount,
    daysSinceLastContact,
    warmthScore,
    lastChannel,
    lastOutcome,
  };
}
