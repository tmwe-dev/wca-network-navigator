/**
 * oracleRefresh.ts — Oracle enrichment freshness check and pending action creation.
 */
import type { PostSendPipelineInput } from "./postSendPipeline.ts";

type SupabaseClient = any;

export async function checkAndCreateEnrichmentRefresh(
  supabase: SupabaseClient,
  input: PostSendPipelineInput,
  now: string,
): Promise<void> {
  if (!input.partnerId) return;

  try {
    const { data: partner } = await supabase
      .from("partners")
      .select("enrichment_data")
      .eq("id", input.partnerId)
      .maybeSingle();

    if (partner?.enrichment_data) {
      const enrichData = partner.enrichment_data as Record<string, unknown>;
      const lastEnrichAt = enrichData.last_enrichment_at as string | null | undefined;
      if (lastEnrichAt) {
        const daysSinceEnrichment = Math.floor((Date.now() - new Date(lastEnrichAt).getTime()) / 86400000);
        if (daysSinceEnrichment > 30) {
          // Create pending action for enrichment refresh
          await supabase.from("ai_pending_actions").insert({
            user_id: input.userId,
            action_type: "refresh_enrichment",
            target_type: "partner",
            target_id: input.partnerId,
            priority: "low",
            status: "pending",
            context: {
              enrichment_age_days: daysSinceEnrichment,
              last_enrichment_at: lastEnrichAt,
              trigger: "post_send_pipeline_stale_check",
              channel: input.channel,
            },
            created_at: now,
          });
        }
      }
    }
  } catch (e) {
    console.warn("[oracleRefresh] oracle refresh check failed:", e);
  }
}
