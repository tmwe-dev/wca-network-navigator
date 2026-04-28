import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { insertActivity } from "@/data/activities";
import { updatePartner } from "@/data/partners";
import { createInteraction } from "@/data/interactions";
import { updateContact } from "@/data/contacts";
import { insertContactInteraction } from "@/data/contactInteractions";
import { updateBusinessCard } from "@/data/businessCards";
import { createLogger } from "@/lib/log";
import type { TrackActivityParams } from "@/types/tracking";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

type _ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];
type _InteractionInsert = Database["public"]["Tables"]["interactions"]["Insert"];

const log = createLogger("useTrackActivity");

/**
 * @deprecated LOVABLE-93: Questo hook è stato sostituito da useLogAction + log-action edge function.
 * Per email: nessun tracking client-side necessario (send-email edge esegue postSendPipeline).
 * Per WhatsApp/LinkedIn: usare useLogAction che chiama log-action edge → postSendPipeline.
 * Mantenuto temporaneamente per retrocompatibilità dei test.
 */

export function useTrackActivity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: TrackActivityParams) => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) throw new Error("Non autenticato");

      const now = new Date().toISOString();

      // 1. Insert completed activity
      try {
        await insertActivity({
          activity_type: params.activityType,
          title: params.title,
          source_id: params.sourceId,
          source_type: params.sourceType,
          partner_id: params.partnerId || null,
          user_id: user.id,
          status: "completed",
          completed_at: now,
          sent_at: params.activityType === "send_email" ? now : null,
          email_subject: params.emailSubject || null,
          description: params.description || null,
        });
      } catch (actErr: unknown) { log.error("track activity insert failed", { message: actErr instanceof Error ? actErr.message : String(actErr) }); }

      // 2. Lead status escalation is handled by server-side postSendPipeline (called by send-email edge function).
      // This client-side tracking is deprecated (LOVABLE-93) and kept only for activity logging + timestamps.
      // Do NOT attempt to update lead_status here — the server RPC enforces proper transitions.
      if (params.sourceType === "partner" && params.partnerId) {
        // Update last_interaction_at timestamp only
        await updatePartner(params.partnerId, { last_interaction_at: now });

        // Create interaction record
        await createInteraction({
          partner_id: params.partnerId,
          interaction_type: params.activityType === "send_email" ? "email" : "note",
          subject: params.emailSubject || params.title,
          notes: params.description || `Attività: ${params.title}`,
        });
      } else if (params.sourceType === "imported_contact") {
        // Update last_interaction_at timestamp only
        await updateContact(params.sourceId, { last_interaction_at: now });

        // Create interaction record
        await insertContactInteraction({
          contact_id: params.sourceId,
          interaction_type: params.activityType === "send_email" ? "email" : "other",
          title: params.emailSubject || params.title,
          description: params.description || null,
          created_by: user.id,
        });
      } else if (params.sourceType === "business_card") {
        // business_cards table has no timestamp column and no server-side guard.
        // Skip both status and timestamp updates for this source type.
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.activities.today });
      qc.invalidateQueries({ queryKey: queryKeys.activities.allActivities });
      qc.invalidateQueries({ queryKey: queryKeys.activities.workedToday });
      qc.invalidateQueries({ queryKey: queryKeys.sorting.jobs });
      qc.invalidateQueries({ queryKey: queryKeys.partners.all });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.paginated() });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.contactsGroupCounts });
    },
  });
}
