/**
 * leadStatusUpdater.ts — Lead status updates for all source types.
 */
import { applyLeadStatusChange } from "./leadStatusGuard.ts";
import type { SourceType, PostSendPipelineInput } from "./postSendPipeline.ts";

type SupabaseClient = any;

export async function updateLeadStatus(
  supabase: SupabaseClient,
  input: PostSendPipelineInput,
  resolvedSourceType: SourceType,
  resolvedSourceId: string,
  now: string,
): Promise<boolean> {
  let statusUpdated = false;

  if (resolvedSourceType === "partner" && input.partnerId) {
    try {
      const { data: partner } = await supabase
        .from("partners")
        .select("lead_status")
        .eq("id", input.partnerId)
        .eq("user_id", input.userId)
        .maybeSingle();

      if (partner) {
        const currentStatus = partner.lead_status || "new";

        if (currentStatus === "new" || !partner.lead_status) {
          const res = await applyLeadStatusChange(supabase, {
            table: "partners",
            recordId: input.partnerId,
            newStatus: "first_touch_sent",
            userId: input.userId,
            actor: { type: "system", name: "postSendPipeline" },
            decisionOrigin: "system_trigger",
            trigger: `Primo messaggio inviato (${input.channel}) via ${input.source}`,
            metadata: {
              channel: input.channel,
              sequence_day: input.sequenceDay ?? 0,
              source: input.source,
            },
          });
          if (res.applied) statusUpdated = true;
        } else {
          await supabase
            .from("partners")
            .update({ last_interaction_at: now })
            .eq("id", input.partnerId)
            .eq("user_id", input.userId);
        }
      }
    } catch (e) {
      console.warn("[leadStatusUpdater] partner status update failed:", e);
    }
  } else if (resolvedSourceType === "imported_contact" && (input.contactId || input.sourceId)) {
    const cid = input.contactId || input.sourceId!;
    try {
      const { data: contact } = await supabase
        .from("imported_contacts")
        .select("lead_status")
        .eq("id", cid)
        .maybeSingle();

      if (contact) {
        const currentStatus = contact.lead_status || "new";
        if (currentStatus === "new" || !contact.lead_status) {
          const res = await applyLeadStatusChange(supabase, {
            table: "imported_contacts",
            recordId: cid,
            newStatus: "first_touch_sent",
            userId: input.userId,
            actor: { type: "system", name: "postSendPipeline" },
            decisionOrigin: "system_trigger",
            trigger: `Primo messaggio inviato (${input.channel}) via ${input.source}`,
            contactIdForAudit: cid,
            metadata: { channel: input.channel, source: input.source },
          });
          if (res.applied) statusUpdated = true;
        } else {
          await supabase
            .from("imported_contacts")
            .update({ last_interaction_at: now })
            .eq("id", cid);
        }
      }
    } catch (e) {
      console.warn("[leadStatusUpdater] contact status update failed:", e);
    }
  } else if (resolvedSourceType === "business_card" && (input.businessCardId || input.sourceId)) {
    const bcid = input.businessCardId || input.sourceId!;
    try {
      const { data: bc } = await supabase
        .from("business_cards")
        .select("lead_status")
        .eq("id", bcid)
        .maybeSingle();

      if (bc) {
        const currentStatus = bc.lead_status || "new";
        if (currentStatus === "new" || !bc.lead_status) {
          const res = await applyLeadStatusChange(supabase, {
            table: "business_cards",
            recordId: bcid,
            newStatus: "first_touch_sent",
            userId: input.userId,
            actor: { type: "system", name: "postSendPipeline" },
            decisionOrigin: "system_trigger",
            trigger: `Primo messaggio inviato (${input.channel}) via ${input.source}`,
            metadata: { channel: input.channel, source: input.source },
          });
          if (res.applied) statusUpdated = true;
        }
      }
    } catch (e) {
      console.warn("[leadStatusUpdater] business_card status update failed:", e);
    }
  }

  return statusUpdated;
}
