/**
 * interactionLogger.ts — Logging interactions for backward compatibility and contact tracking.
 */
import type { SourceType, PostSendPipelineInput } from "./postSendPipeline.ts";
import { channelLabel } from "./pipelineUtils.ts";

type SupabaseClient = any;

export async function logInteractions(
  supabase: SupabaseClient,
  input: PostSendPipelineInput,
  resolvedSourceType: SourceType,
  resolvedSourceId: string,
  now: string,
): Promise<{ contactInteractionLogged: boolean }> {
  let contactInteractionLogged = false;

  // Log to interactions table (partner retrocompat)
  if (resolvedSourceType === "partner" && input.partnerId) {
    try {
      await supabase.from("interactions").insert({
        partner_id: input.partnerId,
        user_id: input.userId,
        interaction_type: input.channel,
        subject: `${channelLabel(input.channel)} a ${input.to}: ${input.subject || ""}`,
        notes: input.body || "",
        interaction_date: now,
      });
    } catch {
      // Silent: interactions is legacy table
    }
  } else if (resolvedSourceType === "imported_contact" && (input.contactId || input.sourceId)) {
    // Log to contact_interactions table
    const cid = input.contactId || input.sourceId!;
    try {
      const { error } = await supabase.from("contact_interactions").insert({
        contact_id: cid,
        interaction_type: input.channel === "email" ? "email" : "other",
        title: input.subject || `${channelLabel(input.channel)} inviato`,
        description: input.body || null,
        created_by: input.userId,
      });
      if (!error) contactInteractionLogged = true;
    } catch (e) {
      console.warn("[interactionLogger] contact_interaction insert failed:", e);
    }
  }

  return { contactInteractionLogged };
}
