/**
 * relationshipAnalyzer.ts — Partner relationship history and metrics analysis.
 * Delegates to sameLocationGuard for heavy lifting; orchestrates metrics exposure.
 */

type SupabaseClient = ReturnType<typeof (await import("https://esm.sh/@supabase/supabase-js@2.39.3")).createClient>;

export interface RelationshipMetrics {
  response_rate: number;
  unanswered_count: number;
  days_since_last_contact: number;
  commercial_state: "new" | "holding" | "engaged";
  total_interactions: number;
}

export async function analyzePartnerRelationship(
  supabase: SupabaseClient,
  partnerId: string | null,
  userId: string,
): Promise<{
  relationshipStage: "cold" | "warm" | "active" | "stale" | "ghosted";
  relationshipMetrics: RelationshipMetrics;
  historyText: string;
  interactionHistoryCount: number;
  relationshipBlock: string;
  branchBlock: string;
  interlocutorBlock: string;
}> {
  const defaultMetrics = {
    response_rate: 0,
    unanswered_count: 0,
    days_since_last_contact: 0,
    commercial_state: "new" as const,
    total_interactions: 0,
  };

  if (!partnerId) {
    return {
      relationshipStage: "cold",
      relationshipMetrics: defaultMetrics,
      historyText: "",
      interactionHistoryCount: 0,
      relationshipBlock: "",
      branchBlock: "",
      interlocutorBlock: "Contatto singolo (non partner identificato nel DB).",
    };
  }

  const { checkSameLocationContacts, getSameCompanyBranches, analyzeRelationshipHistory, buildInterlocutorTypeBlock, buildBranchCoordinationBlock, buildRelationshipAnalysisBlock } = await import("../_shared/sameLocationGuard.ts");

  try {
    const guardResult = await checkSameLocationContacts(supabase, partnerId, null, userId);
    if (!guardResult.allowed) {
      throw Object.assign(new Error(guardResult.reason), { code: "duplicate_branch", recentContact: guardResult.recentContact });
    }

    const { metrics, historyText } = await analyzeRelationshipHistory(supabase, partnerId, userId);
    const relationshipBlock = buildRelationshipAnalysisBlock(metrics);
    const branches = await getSameCompanyBranches(supabase, partnerId);
    const branchBlock = buildBranchCoordinationBlock(branches, "");
    const interlocutorBlock = buildInterlocutorTypeBlock("partner");

    return {
      relationshipStage: metrics.relationship_stage,
      relationshipMetrics: {
        response_rate: metrics.response_rate ?? 0,
        unanswered_count: metrics.unanswered_count ?? 0,
        days_since_last_contact: metrics.days_since_last_contact ?? 0,
        commercial_state: metrics.commercial_state,
        total_interactions: metrics.total_interactions ?? 0,
      },
      historyText,
      interactionHistoryCount: metrics.total_interactions ?? 0,
      relationshipBlock,
      branchBlock,
      interlocutorBlock,
    };
  } catch (e) {
    console.warn("[analyzePartnerRelationship] relationship analysis failed:", e);
    return {
      relationshipStage: "cold",
      relationshipMetrics: defaultMetrics,
      historyText: "",
      interactionHistoryCount: 0,
      relationshipBlock: "",
      branchBlock: "",
      interlocutorBlock: "Partner identificato, ma storia relazionale non disponibile.",
    };
  }
}
