/**
 * senderGrouping.ts — Senders without group suggestion using classification.
 * Extracted from postClassificationPipeline.ts (LOVABLE-93 feature)
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * Auto-suggest group for unknown senders based on classification confidence.
 * If the sender doesn't have a group yet, use classification + confidence to suggest one.
 */
export async function suggestGroupForSender(
  supabase: SupabaseClient,
  userId: string,
  emailAddress: string,
  category: string,
  confidence: number,
): Promise<void> {
  try {
    const { data: addressRule } = await supabase
      .from("email_address_rules")
      .select("id, group_id, ai_suggested_group, ai_suggestion_confidence")
      .eq("user_id", userId)
      .eq("email_address", emailAddress)
      .maybeSingle();

    if (!addressRule) return;

    const hasGroup = !!addressRule.group_id;
    const currentSuggestionConfidence = addressRule.ai_suggestion_confidence || 0;
    const shouldUpdate = !hasGroup && confidence > currentSuggestionConfidence;

    if (shouldUpdate) {
      await supabase
        .from("email_address_rules")
        .update({
          ai_suggested_group: `auto_${category}`,
          ai_suggestion_confidence: confidence,
        })
        .eq("id", addressRule.id);
    }
  } catch (aiSuggestErr) {
    console.warn("[classify-email-response] AI suggestion update error (non-blocking):", aiSuggestErr);
  }
}
